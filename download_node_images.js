const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const NODES_FILE = path.join(__dirname, 'data', 'nodes_data.json');
const OUTPUT_DIR = path.join(__dirname, 'public', 'img', 'nodes');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extracts domain from URL
 */
function getDomain(url) {
    if (!url) return null;
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch (e) {
        return null;
    }
}

/**
 * Downloads an image from a URL
 */
function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(OUTPUT_DIR, filename);

        // Skip if already exists
        if (fs.existsSync(filePath)) {
            return resolve('exists');
        }

        const fetchUrl = (currentUrl) => {
            const request = https.get(currentUrl, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    let redirectUrl = response.headers.location;
                    if (!redirectUrl.startsWith('http')) {
                        const urlObj = new URL(currentUrl);
                        redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                    }
                    return fetchUrl(redirectUrl);
                } else if (response.statusCode === 200) {
                    const fileStream = fs.createWriteStream(filePath);
                    response.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve('downloaded');
                    });
                } else {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                }
            });

            request.on('error', (err) => {
                reject(err);
            });

            request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        };

        fetchUrl(url);
    });
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting node images download...');

    let data;
    try {
        const rawData = fs.readFileSync(NODES_FILE, 'utf8');
        data = JSON.parse(rawData);
    } catch (err) {
        console.error('❌ Error reading nodes_data.json:', err.message);
        return;
    }

    const nodes = data.nodes || {};
    const nodeIds = Object.keys(nodes);
    let validNodeCount = 0;
    let dataUpdated = false;

    const results = {
        downloaded: [],
        existed: [],
        failed: [],
        skipped: []
    };

    console.log(`📦 Analyzing nodes...`);

    for (const id of nodeIds) {
        if (id === 'root') continue;
        validNodeCount++;

        const node = nodes[id];
        const domain = getDomain(node.url);

        // We use Google Favicons API as Primary source
        // If no URL, we try some heuristics or skip
        let logoUrl = null;

        if (domain) {
            logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        } else {
            // Fallback heuristics for common tools without explicit valid URLs in data
            const fallbacks = {
                'javascript': 'https://www.google.com/s2/favicons?domain=javascript.info&sz=128',
                'python': 'https://www.google.com/s2/favicons?domain=python.org&sz=128',
                'cpp': 'https://www.google.com/s2/favicons?domain=isocpp.org&sz=128',
                'csharp': 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128',
                'github': 'https://www.google.com/s2/favicons?domain=github.com&sz=128',
                'processing': 'https://www.google.com/s2/favicons?domain=processing.org&sz=128',
                'arduino': 'https://www.google.com/s2/favicons?domain=arduino.cc&sz=128',
                'blender': 'https://www.google.com/s2/favicons?domain=blender.org&sz=128'
            };
            logoUrl = fallbacks[id];
        }

        if (logoUrl) {
            try {
                process.stdout.write(`  [${id}] Downloading from ${logoUrl}... `);
                const status = await downloadImage(logoUrl, `${id}.png`);

                if (status === 'exists') {
                    console.log('⏭️  (Already exists)');
                    results.existed.push(id);
                } else {
                    console.log('✅ (Downloaded)');
                    results.downloaded.push(id);
                }

                // Update node JSON data
                node.image = `img/nodes/${id}.png`;

                // Prepend image to infoHTML if not already there
                const imgTag = `<div style="text-align:center; margin-bottom:15px;"><img src="img/nodes/${id}.png" style="max-width:100%; max-height:150px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.3);" onerror="this.parentElement.style.display='none'"></div>`;

                if (node.infoHTML) {
                    if (!node.infoHTML.includes(`<img src="img/nodes/${id}.png"`)) {
                        node.infoHTML = imgTag + node.infoHTML;
                    }
                } else {
                    node.infoHTML = imgTag + `<h3>${node.label || id}</h3>` + (node.info ? `<p>${node.info}</p>` : '');
                }

                dataUpdated = true;
            } catch (err) {
                console.log(`❌ (${err.message})`);
                results.failed.push(id);
            }
        } else {
            console.log(`  [${id}] No URL/domain found, skipping.`);
            results.skipped.push(id);
        }

        // Small delay to avoid hitting APIs too fast
        await new Promise(r => setTimeout(r, 100));
    }

    if (dataUpdated) {
        try {
            fs.writeFileSync(NODES_FILE, JSON.stringify(data, null, 2), 'utf8');
            console.log('\n📝 Actualizado "nodes_data.json" con referencias a las imágenes oficiales.');
        } catch (err) {
            console.error('\n❌ Error al guardar "nodes_data.json":', err.message);
        }
    }

    console.log('\n=============================================');
    console.log('                 📊 SUMMARY                 ');
    console.log('=============================================');
    console.log(`Total Nodes Processed: ${validNodeCount}`);
    console.log(`\n📁 Ya existían (${results.existed.length}):`);
    if (results.existed.length) console.log(`   ${results.existed.join(', ')}`);
    else console.log(`   Ninguno`);

    console.log(`\n✅ Descargados exitosamente (${results.downloaded.length}):`);
    if (results.downloaded.length) console.log(`   ${results.downloaded.join(', ')}`);
    else console.log(`   Ninguno`);

    console.log(`\n⏭️  Sin URL / Saltados (${results.skipped.length}):`);
    if (results.skipped.length) console.log(`   ${results.skipped.join(', ')}`);
    else console.log(`   Ninguno`);

    console.log(`\n❌ Error de descarga (${results.failed.length}):`);
    if (results.failed.length) console.log(`   ${results.failed.join(', ')}`);
    else console.log(`   Ninguno`);

    console.log('\n=============================================');
    console.log(`Las imágenes se guardan en: ${OUTPUT_DIR}`);
}

main();
