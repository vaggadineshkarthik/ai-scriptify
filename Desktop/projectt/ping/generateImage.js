import fs from 'fs';

const generateImage = async () => {
  const promptText = "A futuristic city skyline at sunset, cyberpunk style, high detail. Screenplay style.";

  try {
    const response = await fetch('https://gateway.pixazo.ai/flux-1-schnell/v1/getData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': 'e6f803fe8afa4d46988b68488eeb8b65'
      },
      body: JSON.stringify({
        prompt: promptText
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        fs.writeFileSync('error_details.txt', `HTTP ${response.status}\n${errorText}`, 'utf8');
        console.log('Error details written to error_details.txt');
        return;
    }

    const data = await response.json();
    console.log("Success! Keys:", Object.keys(data));
    
    // Save response to debug format
    fs.writeFileSync('response.json', JSON.stringify(data, null, 2));

    let returnedImage = '';
    if (data.image_url) {
      returnedImage = data.image_url;
    } else if (data.data && data.data.length > 0 && data.data[0].url) {
      returnedImage = data.data[0].url;
    } else if (data.images && data.images.length > 0) {
      returnedImage = data.images[0];
    } else if (data.image) {
      returnedImage = data.image;
    }

    if (returnedImage) {
      if (returnedImage.startsWith('http')) {
        console.log("Image URL:", returnedImage);
        const imgRes = await fetch(returnedImage);
        const imgBuffer = await imgRes.arrayBuffer();
        fs.writeFileSync('sample_scene.png', Buffer.from(imgBuffer));
        console.log("Saved as sample_scene.png");
      } else {
        const base64Data = returnedImage.replace(/^data:image\/[a-z]+;base64,/, "");
        fs.writeFileSync("sample_scene.png", base64Data, 'base64');
        console.log("Saved base64 as sample_scene.png");
      }
    } else {
        console.log("No valid image found in response.", data);
    }
  } catch (err) {
    fs.writeFileSync('error_details.txt', String(err), 'utf8');
    console.error('Network error written to error_details.txt');
  }
};

generateImage();
