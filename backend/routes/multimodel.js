const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const { llmModelImage, llmModelVideo, textToSpeech } = require('./multimodelHelper');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'temp_' + file.fieldname + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

/**
 * Safe delete with retries for Windows file lock (EPERM, EBUSY)
 */
async function safeDelete(filePath, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await fsPromises.unlink(filePath);
      console.log(`✅ Deleted: ${filePath}`);
      return;
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EBUSY') {
        console.warn(`File locked, retrying in 500ms... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (err.code === 'ENOENT') {
        console.log(`File already deleted: ${filePath}`);
        return;
      } else {
        console.error('Error deleting file:', err);
        return;
      }
    }
  }
  console.error(`❌ Failed to delete file after ${retries} attempts: ${filePath}`);
}

// ✅ IMAGE QUERY ENDPOINT
router.post('/image-query', upload.single('image'), async (req, res) => {
  let imagePath;
  try {
    const queryText = req.body.query_text;
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded. Use key 'image' in form-data." });
    }
    imagePath = req.file.path;

    console.log(`📥 Received image query: ${queryText}`);
    console.log(`Image path: ${imagePath}`);

    // Process image with model
    const response = await llmModelImage(queryText, imagePath);

    // Convert response to speech
    await textToSpeech(response);

    res.status(200).json({ text_response: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (imagePath) {
      // Delay deletion slightly to avoid file-lock issues
      setTimeout(() => safeDelete(imagePath), 1000);
    }
  }
});

// ✅ VIDEO QUERY ENDPOINT
router.post('/video-query', upload.single('video'), async (req, res) => {
  let videoPath;
  try {
    const queryText = req.body.query_text;
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded. Use key 'video' in form-data." });
    }
    videoPath = req.file.path;

    console.log(`📥 Received video query: ${queryText}`);
    console.log(`Video path: ${videoPath}`);

    // Process video with model
    const response = await llmModelVideo(queryText, videoPath);

    // Convert response to speech
    await textToSpeech(response);

    res.status(200).json({ text_response: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (videoPath) {
      setTimeout(() => safeDelete(videoPath), 1500);
    }
  }
});

// ✅ AUDIO DOWNLOAD ENDPOINT
router.get('/download-audio', (req, res) => {
  const audioFilePath = path.join(__dirname, '..', 'speech.mp3');
  if (fs.existsSync(audioFilePath)) {
    res.download(audioFilePath, 'speech.mp3', (err) => {
      if (err) {
        console.error('Error downloading audio file:', err);
      } else {
        // Delete audio file after sending
        setTimeout(() => safeDelete(audioFilePath), 500);
      }
    });
  } else {
    res.status(404).json({ error: 'Audio file not found' });
  }
});

module.exports = router;
