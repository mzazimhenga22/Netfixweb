async function testVidLink() {
  // Using Fight Club (TMDB: 550) as a test case
  const tmdbId = '550';
  const apiEndpoint = `https://vidlink.pro/api/movie/${tmdbId}`;
  
  console.log(`[Test] 🔍 Testing VidLink Resolution for TMDB ID: ${tmdbId}`);
  
  try {
    const response = await fetch(apiEndpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': `https://vidlink.pro/movie/${tmdbId}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
      }
    });

    if (!response.ok) {
      console.log(`[Test] ❌ Request failed with status: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`[Test] Body Snippet: ${text.substring(0, 200)}`);
      return;
    }

    const data = await response.json();
    console.log(`[Test] ✅ Success! Received Data:`);
    console.log(JSON.stringify(data, null, 2));
    
    if (data?.stream?.playlist) {
      console.log(`\n[Test] 🎉 EXTRACTED M3U8 LINK: ${data.stream.playlist}`);
    } else {
      console.log(`\n[Test] ⚠️ Warning: JSON received but 'stream.playlist' is missing.`);
    }

  } catch (error) {
    console.error(`[Test] 💥 Unexpected Error:`, error.message);
  }
}

testVidLink();
