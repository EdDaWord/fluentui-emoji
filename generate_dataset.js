#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

// Load emoji categories
let emojiCategories = null;
let manualCategories = null;

async function loadEmojiCategories() {
  if (emojiCategories) return emojiCategories;
  
  try {
    const categoriesPath = path.join(__dirname, 'EmojisCategories.json');
    const content = await readFile(categoriesPath, 'utf-8');
    const data = JSON.parse(content);
    emojiCategories = data.emojis;
    return emojiCategories;
  } catch (error) {
    console.warn('Failed to load emoji categories:', error.message);
    return {};
  }
}

async function loadManualCategories() {
  if (manualCategories) return manualCategories;
  
  try {
    const manualPath = path.join(__dirname, 'ManualEmojisCategories.json');
    const content = await readFile(manualPath, 'utf-8');
    const data = JSON.parse(content);
    manualCategories = data;
    return manualCategories;
  } catch (error) {
    console.warn('Failed to load manual emoji categories:', error.message);
    return {};
  }
}

function findEmojiCategory(emojiName, categories, manualCategories, emojiGlyph) {
  // First check manual categories by glyph
  if (manualCategories && emojiGlyph) {
    for (const [categoryName, glyphs] of Object.entries(manualCategories)) {
      if (Array.isArray(glyphs) && glyphs.includes(emojiGlyph)) {
        return categoryName;
      }
    }
  }
  
  // Fall back to main categories if not found in manual categories
  if (!categories) return 'other';
  
  // Normalize the emoji name for matching
  const normalizedName = emojiName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  for (const [categoryName, subcategories] of Object.entries(categories)) {
    for (const [subcategoryName, emojis] of Object.entries(subcategories)) {
      if (Array.isArray(emojis)) {
        for (const emoji of emojis) {
          if (emoji.name && emoji.name.toLowerCase() === normalizedName) {
            return categoryName;
          }
          // Also try partial matching for cases where names might not match exactly
          if (emoji.name && emoji.name.toLowerCase().includes(normalizedName)) {
            return categoryName;
          }
        }
      }
    }
  }
  
  return 'other';
}

function isManualCategory(category, manualCategories) {
  if (!manualCategories) return false;
  return Object.keys(manualCategories).includes(category);
}

async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function findAssetDirectories(assetsPath) {
  const directories = [];
  const items = await readdir(assetsPath);
  
  for (const item of items) {
    const itemPath = path.join(assetsPath, item);
    const itemStat = await stat(itemPath);
    
    if (itemStat.isDirectory()) {
      // Check if this directory has a metadata.json file
      const metadataPath = path.join(itemPath, 'metadata.json');
      try {
        await stat(metadataPath);
        directories.push(itemPath);
      } catch (error) {
        // No metadata.json, skip this directory
      }
    }
  }
  
  return directories;
}

async function find3DFiles(assetDir) {
  const threeDDir = path.join(assetDir, '3D');
  const files = [];
  
  try {
    const threeDStat = await stat(threeDDir);
    if (threeDStat.isDirectory()) {
      const threeDFiles = await readdir(threeDDir);
      for (const file of threeDFiles) {
        if (file.endsWith('.png')) {
          files.push({
            originalPath: path.join(threeDDir, file),
            filename: file
          });
        }
      }
    }
  } catch (error) {
    // No 3D directory or not accessible
  }
  
  return files;
}

async function readMetadata(assetDir) {
  const metadataPath = path.join(assetDir, 'metadata.json');
  try {
    const content = await readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Failed to read metadata for ${assetDir}:`, error.message);
    return null;
  }
}

function generateCaptions(metadata, filename, category = null) {
  const captions = [];
  
  if (!metadata) {
    // Fallback caption if no metadata
    const baseName = filename.replace('_3d.png', '').replace(/_/g, ' ');
    const caption = category ? `${baseName}. Category of ${category}` : baseName;
    captions.push(caption);
    return captions;
  }
  
  const { cldr, keywords, glyph } = metadata;
  
  // Generate caption with CLDR name and keywords (without emoji glyph)
  let baseCaption = '';
  if (cldr) {
    if (keywords && keywords.length > 0) {
      // Remove duplicates: filter out keywords that match the CLDR name (case-insensitive)
      const uniqueKeywords = keywords.filter(keyword => 
        keyword.toLowerCase() !== cldr.toLowerCase()
      );
      
      if (uniqueKeywords.length > 0) {
        // Format: "cldr (keyword1, keyword2, keyword3)" - no emoji glyph
        const keywordText = uniqueKeywords.join(', ');
        baseCaption = `${cldr} (${keywordText})`;
      } else {
        // Just CLDR name if no unique keywords - no emoji glyph
        baseCaption = cldr;
      }
    } else {
      // Just CLDR name if no keywords - no emoji glyph
      baseCaption = cldr;
    }
  } else if (keywords && keywords.length > 0) {
    // Fallback to keywords if no CLDR - no emoji glyph
    const keywordText = keywords.join(', ');
    baseCaption = `(${keywordText})`;
  } else if (glyph) {
    // Just use CLDR name if available, otherwise fallback to filename
    baseCaption = cldr || filename.replace('_3d.png', '').replace(/_/g, ' ');
  }
  
  // Add category information if provided
  if (category) {
    baseCaption += `. Category of ${category}`;
  }
  
  captions.push(baseCaption);
  return captions;
}

async function processAssets() {
  const assetsPath = path.join(__dirname, 'assets');
  const manualDataDir = path.join(__dirname, 'manual', 'data');
  const manualJsonlDir = path.join(__dirname, 'manual', 'jsonl');
  
  console.log('Loading emoji categories...');
  const categories = await loadEmojiCategories();
  const manualCategories = await loadManualCategories();
  
  console.log('Creating manual directories...');
  await ensureDir(manualDataDir);
  await ensureDir(manualJsonlDir);
  
  console.log('Scanning asset directories...');
  const assetDirectories = await findAssetDirectories(assetsPath);
  console.log(`Found ${assetDirectories.length} asset directories`);
  
  const manualCategoryEntries = {};
  const manualCategoryStats = {};
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const assetDir of assetDirectories) {
    const assetName = path.basename(assetDir);
    console.log(`Processing ${assetName}...`);
    
    // Find 3D files in this asset directory
    const threeDFiles = await find3DFiles(assetDir);
    
    if (threeDFiles.length === 0) {
      console.log(`  No 3D files found for ${assetName}`);
      skippedCount++;
      continue;
    }
    
    // Read metadata
    const metadata = await readMetadata(assetDir);
    
    // Determine category for this emoji
    const emojiName = metadata?.cldr || assetName.replace(/_/g, ' ');
    const emojiGlyph = metadata?.glyph;
    const category = findEmojiCategory(emojiName, categories, manualCategories, emojiGlyph);
    
    // Check if this is a manual category - only process manual categories
    const isManual = isManualCategory(category, manualCategories);
    if (!isManual) {
      console.log(`  Skipping ${assetName} - not in manual categories`);
      skippedCount++;
      continue;
    }
    
    // Initialize manual category stats and entries
    if (!manualCategoryStats[category]) {
      manualCategoryStats[category] = 0;
      manualCategoryEntries[category] = [];
    }
    
    // Process each 3D file (usually just one, but some assets might have variants)
    for (const fileInfo of threeDFiles) {
      const { originalPath, filename } = fileInfo;
      
      // Generate a safe filename for the manual data directory
      const safeFilename = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
      
      try {
        // Copy the file to manual category directory
        const manualCategoryDir = path.join(manualDataDir, category);
        await ensureDir(manualCategoryDir);
        const manualTargetPath = path.join(manualCategoryDir, safeFilename);
        await copyFile(originalPath, manualTargetPath);
        
        // Generate captions
        const captions = generateCaptions(metadata, filename, category);
        
        // Create JSONL entries for manual category
        for (const caption of captions) {
          const manualRelativePath = `data/${category}/${safeFilename}`;
          manualCategoryEntries[category].push({
            image: manualRelativePath,
            caption: caption
          });
        }
        
        manualCategoryStats[category]++;
        processedCount++;
        
      } catch (error) {
        console.error(`Failed to process ${filename}:`, error.message);
        skippedCount++;
      }
    }
  }
  
  // Write manual category JSONL files
  console.log(`\nWriting manual category JSONL files...`);
  let manualTotalEntries = 0;
  for (const [category, entries] of Object.entries(manualCategoryEntries)) {
    if (entries.length > 0) {
      // Convert category name to CamelCase
      const camelCaseName = category
        .replace(/[^a-z0-9\s-]/gi, '') // Remove special characters except spaces and hyphens
        .split(/[\s-]+/) // Split on spaces and hyphens
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      const outputFile = path.join(manualJsonlDir, `${camelCaseName}.jsonl`);
      const jsonlContent = entries
        .map(entry => JSON.stringify(entry))
        .join('\n');
      
      await writeFile(outputFile, jsonlContent, 'utf-8');
      manualTotalEntries += entries.length;
      console.log(`  - ${category}: ${entries.length} entries -> ${outputFile}`);
    }
  }
  
  console.log(`\nDataset generation complete!`);
  console.log(`- Processed: ${processedCount} assets`);
  console.log(`- Skipped: ${skippedCount} assets`);
  console.log(`- Manual JSONL entries: ${manualTotalEntries}`);
  console.log(`- Manual images copied to: ${manualDataDir}`);
  console.log(`- Manual JSONL files written to: ${manualJsonlDir}`);
  console.log(`\nManual category breakdown:`);
  for (const [category, count] of Object.entries(manualCategoryStats)) {
    console.log(`  - ${category}: ${count} emojis`);
  }
}

// Run the script
if (require.main === module) {
  processAssets().catch(error => {
    console.error('Error processing assets:', error);
    process.exit(1);
  });
}

module.exports = { processAssets };
