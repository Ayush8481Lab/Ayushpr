export default async function handler(req, res) {
  // 1. Allow CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. Query Parameters (Language and Image Quality)
  const ln = req.query.ln || 'hindi';
  const q = req.query.q || 'h'; // Options: l (150), m (350), h (500)

  const imgQuality = q === 'l' ? '150x150' : q === 'm' ? '350x350' : '500x500';

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  const decodeEntities = (text) => {
    if (!text) return "";
    return text.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  };

  const getHighResImage = (url) => {
    if (!url) return "https://via.placeholder.com/500x500?text=Music";
    return url.replace(/150x150|50x50/g, imgQuality);
  };

  const getSubtitle = (item) => {
    let sub = "";
    if (item.more_info?.artistMap?.primary_artists) {
      sub = item.more_info.artistMap.primary_artists.map(a => a.name).join(", ");
    } else if (item.more_info?.singers) {
      sub = item.more_info.singers;
    } else if (item.subtitle) {
      sub = item.subtitle;
    }
    return decodeEntities(sub);
  };

  const formatItem = (item, overrideType = null, noSubtitle = false) => ({
    title: decodeEntities(item.title || item.name || ""),
    subtitle: noSubtitle ? "" : getSubtitle(item),
    type: overrideType || item.type || "",
    image_link: getHighResImage(item.image || item.image_url || ""),
    perma_url: item.perma_url || item.url || item.action || ""
  });

  const mergeAndDedupe = (arr1, arr2) => {
    const map = new Map();
    [...(arr1 || []), ...(arr2 ||[])].forEach(item => {
      if (item && item.id && !map.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
  };

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.jiosaavn.com/"
    };

    // 3. Fetch Base APIs Concurrently
    const[
      launchRes, artistsRes, featuredRes, albumsRes, 
      trendingSongsRes, trendingPlaylistsRes, footerRes
    ] = await Promise.all([
      fetch(`https://www.jiosaavn.com/api.php?__call=webapi.getLaunchData&api_version=4&_format=json&_marker=0&ctx=wap6dot0&languages=${ln}`, { headers }),
      fetch(`https://www.jiosaavn.com/api.php?__call=social.getTopArtists&api_version=4&_format=json&_marker=0&ctx=wap6dot0&languages=${ln}`, { headers }),
      fetch(`https://www.jiosaavn.com/api.php?__call=content.getFeaturedPlaylists&fetch_from_serialized_files=true&p=1&n=50&api_version=4&_format=json&_marker=0&ctx=wap6dot0&languages=${ln}`, { headers }),
      fetch(`https://www.jiosaavn.com/api.php?__call=content.getAlbums&api_version=4&_format=json&_marker=0&n=50&p=1&ctx=wap6dot0&languages=${ln}`, { headers }),
      fetch(`https://www.jiosaavn.com/api.php?__call=content.getTrending&api_version=4&_format=json&_marker=0&ctx=wap6dot0&entity_type=song&entity_language=${ln}`, { headers }),
      fetch(`https://www.jiosaavn.com/api.php?__call=content.getTrending&api_version=4&_format=json&_marker=0&ctx=wap6dot0&entity_type=playlist&entity_language=${ln}`, { headers }),
      fetch(`https://www.jiosaavn.com/api.php?__call=webapi.getFooterDetails&language=${ln}&api_version=4&_format=json&_marker=0`, { headers })
    ]);

    // JSON Parser Helper
    const parseRes = async (res, isArray = false) => {
      const text = await res.text();
      const startIndex = text.indexOf(isArray ? '[' : '{');
      if (startIndex === -1) return isArray ? [] : {};
      return JSON.parse(text.substring(startIndex));
    };

    const launchJson = await parseRes(launchRes, false);
    const artistsJson = await parseRes(artistsRes, false);
    const featuredJson = await parseRes(featuredRes, false);
    const albumsJson = await parseRes(albumsRes, false);
    const trendSongs = await parseRes(trendingSongsRes, true);
    const trendPlaylists = await parseRes(trendingPlaylistsRes, true);
    const footerJson = await parseRes(footerRes, false);

    // ==========================================
    // FORMATTING & SHUFFLING
    // ==========================================
    const rawTrending = mergeAndDedupe(launchJson.new_trending, mergeAndDedupe(trendSongs, trendPlaylists));
    const trending = shuffleArray(rawTrending).map(i => formatItem(i));

    const newReleases = (albumsJson.data ||[]).map(i => formatItem(i, "album"));

    const rawFeatured = mergeAndDedupe(featuredJson.data, trendPlaylists);
    const featuredPlaylists = shuffleArray(rawFeatured).map(i => formatItem(i, "playlist"));

    let promoModules =[];
    if (launchJson.modules) {
      const exclude = ["new_trending", "new_albums", "charts", "top_playlists"];
      const activeModules = Object.keys(launchJson.modules)
        .map(key => ({ key, ...launchJson.modules[key] }))
        .sort((a, b) => a.position - b.position)
        .filter(m => m.source !== "radio" && m.type !== "radio_station" && m.source !== "artist_recos" && !exclude.includes(m.source));

      promoModules = activeModules.map(p => ({
        title: decodeEntities(p.title),
        data: (launchJson[p.key] ||[]).map(i => formatItem(i))
      })).filter(p => p.data.length > 0);
    }

    const topCharts = (launchJson.charts ||[]).map(i => formatItem(i, "playlist", true));
    const topArtists = (artistsJson.top_artists ||[]).map(i => formatItem(i, "artist", true));

    // ==========================================
    // FOOTER DETAILS (Extracting Tokens & Fetching Real Images)
    // ==========================================
    const resolveFooterImages = async (items, type) => {
      if (!items) return[];
      const limitedItems = items.slice(0, 10); // Keep API fast by limiting array
      
      const promises = limitedItems.map(async (item) => {
        try {
          // 1. Get the action URL and remove any trailing '?'
          let action = item.action || item.url || "";
          if (action.endsWith('?')) {
            action = action.slice(0, -1);
          }
          
          // 2. Extract the true token
          const parts = action.split('/').filter(Boolean);
          if (parts.length === 0) throw new Error("No token found");
          const token = parts[parts.length - 1]; 
          
          // 3. Map actors to 'artist' for JioSaavn API
          let callType = type === 'actor' ? 'artist' : type;

          // 4. Fetch the real details using the token
          const res = await fetch(`https://www.jiosaavn.com/api.php?__call=webapi.get&token=${token}&type=${callType}&_format=json`, { headers });
          const text = await res.text();
          const json = JSON.parse(text.substring(text.indexOf('{')));
          
          // 5. Return the perfectly formatted requested payload
          return {
            title: decodeEntities(item.title || item.name || ""),
            subtitle: "", // Purposely left blank for artists, actors, playlists, albums as requested
            type: type,
            image_link: getHighResImage(json.image || json.image_url || ""),
            perma_url: json.perma_url || action || ""
          };
        } catch (e) {
          // Fallback if the inner fetch fails
          return { 
            title: decodeEntities(item.title || item.name || ""), 
            subtitle: "", 
            type: type, 
            image_link: getHighResImage(""), 
            perma_url: item.action || "" 
          };
        }
      });
      return Promise.all(promises);
    };

    // Fetch all image tokens concurrently
    const[recoArtists, recoActors, recoAlbums, recoPlaylists] = await Promise.all([
      resolveFooterImages(footerJson.artist, "artist"),
      resolveFooterImages(footerJson.actor, "actor"),
      resolveFooterImages(footerJson.album, "album"),
      resolveFooterImages(footerJson.playlist, "playlist")
    ]);

    // ==========================================
    // FINAL MASTER RESPONSE
    // ==========================================
    res.status(200).json({
      trending,
      new_releases: newReleases,
      featured_playlists: featuredPlaylists,
      promo_modules: promoModules,
      top_charts: topCharts,
      top_artists: topArtists,
      recommended_artists: recoArtists,
      recommended_actors: recoActors,
      recommended_albums: recoAlbums,
      recommended_playlists: recoPlaylists
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to construct home data', details: error.message });
  }
}
