# FluentUI Emoji Dataset Generator

This Node.js script generates a JSONL training dataset from the FluentUI emoji 3D assets, perfect for training image captioning models or other machine learning tasks.

## Features

- Scans all FluentUI emoji assets for 3D PNG files
- Extracts metadata (CLDR names, keywords, groups) from `metadata.json` files
- Generates multiple caption variations for each emoji:
  - Basic emoji name (e.g., "emoji monkey")
  - Descriptive captions (e.g., "fluent emoji of monkey, 3D style")
  - Keyword-based captions (e.g., "emoji representing animal, mammal, primate")
  - Group-based captions (e.g., "animals & nature emoji: monkey")
  - Style-specific captions (e.g., "3D fluent emoji monkey with soft gradient and modern design")

## Usage

1. **Install dependencies** (if any):
   ```bash
   npm install
   ```

2. **Run the script**:
   ```bash
   npm start
   # or
   node generate_dataset.js
   ```

3. **Output**:
   - All 3D emoji images will be copied to the `data/` directory
   - A `emoji_dataset.jsonl` file will be created with the training data

## Output Format

The generated JSONL file contains entries like:

```json
{"image": "data/monkey_3d.png", "caption": "emoji monkey"}
{"image": "data/monkey_3d.png", "caption": "fluent emoji of monkey, 3D style"}
{"image": "data/monkey_3d.png", "caption": "animals & nature emoji: monkey"}
{"image": "data/monkey_3d.png", "caption": "emoji representing animal, mammal, primate"}
{"image": "data/monkey_3d.png", "caption": "3D fluent emoji monkey with soft gradient and modern design"}
{"image": "data/monkey_3d.png", "caption": "cartoon animal emoji in 3D style"}
```

## Script Details

- **Asset Discovery**: Automatically finds all asset directories containing `metadata.json` files
- **3D File Detection**: Looks for PNG files in the `3D/` subdirectory of each asset
- **Metadata Parsing**: Extracts CLDR names, keywords, TTS names, and group information
- **Caption Generation**: Creates 6-7 different caption variations per emoji
- **File Management**: Safely copies images with sanitized filenames
- **Error Handling**: Gracefully handles missing files or invalid metadata

## Requirements

- Node.js 12.0.0 or higher
- Access to the FluentUI emoji assets directory structure

## Statistics

The script will process approximately:
- 3,145 3D emoji images
- Generate 18,000+ caption variations
- Cover all emoji groups (Animals, Objects, People, etc.)
