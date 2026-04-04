export default async function handler(req, res) {
  // Allow all CORS so you can use this in any app without errors
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const url = `https://www.jiosaavn.com/api.php?__call=webapi.get&token=${token}&type=artist&p=1&n_song=50&n_album=50&sub_type=&category=&sort_order=&includeMetaTags=0&ctx=wap6dot0&api_version=4&_format=json&_marker=0`;
    
    const response = await fetch(url);
    const responseText = await response.text();
    
    // Safety check: JioSaavn sometimes adds junk text before the JSON starts
    const cleanText = responseText.substring(responseText.indexOf('{'));
    const data = JSON.parse(cleanText);

    // Format the response exactly as you requested
    const result = {
      artistId: data.artistId,
      name: data.name,
      subtitle: data.subtitle,
      image: data.image,
      follower_count: data.follower_count,
      type: data.type,
      isVerified: data.isVerified,
      is_followed: data.is_followed,
      dominantLanguage: data.dominantLanguage,
      dominantType: data.dominantType,
      modules: {
        singles: data.singles ||[],
        latest_release: data.latest_release || [],
        dedicated_artist_playlist: data.dedicated_artist_playlist ||[],
        featured_artist_playlist: data.featured_artist_playlist ||[],
        similarArtists: data.similarArtists ||[]
      }
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data from JioSaavn' });
  }
}
