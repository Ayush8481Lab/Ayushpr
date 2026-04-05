export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ln = req.query.ln || 'hindi';
  const q = req.query.q || 'h';
  const sz = q === 'l' ? '150x150' : q === 'm' ? '350x350' : '500x500';

  const dec = s => s ? s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "";
  const img = u => u ? u.replace(/(150x150|50x50|350x350|500x500)/g, sz) : "https://via.placeholder.com/500x500?text=Music";
  const getS = i => dec(i.more_info?.artistMap?.primary_artists?.map(a => a.name).join(", ") || i.more_info?.singers || i.subtitle || "");

  const f = (i, tO = null, noS = false) => {
    const t = tO || i.type || "";
    const r = { 
      id: i.id || i.artistid || "", 
      title: dec(i.title || i.name || ""), 
      subtitle: noS ? "" : getS(i), 
      type: t, 
      image_link: img(i.image || i.image_url || ""), 
      perma_url: i.perma_url || i.url || i.action || "" 
    };
    if (t === 'artist' || t === 'actor') r.artist_id = r.id;
    return r;
  };

  const dedup = (a, b) => Array.from(new Map([...(a || Array()), ...(b || Array())].filter(x => x?.id).map(x => [x.id, x])).values());
  const shf = a => a.sort(() => Math.random() - 0.5);

  const fJ = async u => {
    try {
      // 'keep-alive' massively drops latency when making 40+ simultaneous fetch calls
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", "Connection": "keep-alive" } });
      const t = await r.text();
      const m = t.match(/[{[]/);
      return m ? JSON.parse(t.substring(m.index)) : null;
    } catch { return null; }
  };

  const rF = async (items, t) => Promise.all((items || Array()).slice(0, 10).map(async i => {
    try {
      const a = (i.action || i.url || "").replace(/\?$/, "");
      const tk = a.split('/').filter(Boolean).pop();
      const d = await fJ(`https://www.jiosaavn.com/api.php?__call=webapi.get&token=${tk}&type=${t==='actor'?'artist':t}&_format=json`);
      if (!d) throw new Error();
      const r = { id: d.id || i.id || "", title: dec(i.title || i.name), subtitle: "", type: t, image_link: img(d.image || d.image_url), perma_url: d.perma_url || a };
      if (t === 'artist' || t === 'actor') r.artist_id = r.id;
      return r;
    } catch {
      const r = { id: i.id || "", title: dec(i.title || i.name), subtitle: "", type: t, image_link: img(""), perma_url: i.action || "" };
      if (t === 'artist' || t === 'actor') r.artist_id = r.id;
      return r;
    }
  }));

  try {
    const url = c => `https://www.jiosaavn.com/api.php?__call=${c}&api_version=4&_format=json&_marker=0&ctx=wap6dot0&languages=${ln}`;
    
    const[lD, aD, fD, albD, tS, tP, fDt] = await Promise.all([
      fJ(url('webapi.getLaunchData')),
      fJ(url('social.getTopArtists')),
      fJ(url('content.getFeaturedPlaylists') + '&fetch_from_serialized_files=true&p=1&n=50'),
      fJ(url('content.getAlbums') + '&n=50&p=1'),
      fJ(url('content.getTrending') + '&entity_type=song&entity_language=' + ln),
      fJ(url('content.getTrending') + '&entity_type=playlist&entity_language=' + ln),
      // BUGFIX: Execute sub-queries simultaneously using Promise.all inside the `.then`
      fJ(`https://www.jiosaavn.com/api.php?__call=webapi.getFooterDetails&language=${ln}&api_version=4&_format=json&_marker=0`).then(async x => {
        if (!x) return {};
        const [ar, ac, al, pl] = await Promise.all([
          rF(x.artist, "artist"), 
          rF(x.actor, "actor"), 
          rF(x.album, "album"), 
          rF(x.playlist, "playlist")
        ]);
        return { ar, ac, al, pl };
      })
    ]);

    const nR = Array(), nPl = Array();
    (albD?.data || Array()).forEach(i => {
      const x = f(i, i.type || 'album');
      x.type === 'playlist' ? nPl.push(x) : nR.push(x);
    });

    const pM = lD?.modules ? Object.entries(lD.modules)
      .map(([k, v]) => ({ k, ...v }))
      .sort((a, b) => a.position - b.position)
      .filter(m => !["new_trending", "new_albums", "charts", "top_playlists", "radio", "radio_station", "artist_recos"].includes(m.source || m.type))
      .map(p => ({ title: dec(p.title), data: (lD[p.k] || Array()).map(i => f(i)) }))
      .filter(p => p.data.length > 0) : Array();

    res.status(200).json({
      trending: shf(dedup(lD?.new_trending, dedup(tS, tP))).map(i => f(i)),
      new_releases: nR,
      featured_playlists: shf(dedup(dedup(fD?.data, tP).map(i => f(i, "playlist")), nPl)),
      promo_modules: pM,
      top_charts: (lD?.charts || Array()).map(i => f(i, "playlist", true)),
      top_artists: (aD?.top_artists || Array()).map(i => f(i, "artist", true)),
      recommended_artists: fDt.ar || Array(),
      recommended_actors: fDt.ac || Array(),
      recommended_albums: fDt.al || Array(),
      recommended_playlists: fDt.pl || Array()
    });
  } catch (error) {
    res.status(500).json({ error: "Server failed to fetch data" });
  }
}
