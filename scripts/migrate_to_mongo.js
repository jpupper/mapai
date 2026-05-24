require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Models
const Node = require('../models/Node');
const Ranking = require('../models/Ranking');
const RankingPV = require('../models/RankingPV');
const AppState = require('../models/AppState');
const SpaceConfig = require('../models/SpaceConfig');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NODES_FILE = path.join(DATA_DIR, 'nodes_data.json');
const RANKING_FILE = path.join(DATA_DIR, 'ranking.json');
const RANKING_PV_FILE = path.join(DATA_DIR, 'ranking_pv.json');
const SPACE_CONFIG_FILE = path.join(DATA_DIR, 'space_config.json');

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        // We'll use the MONGODB_URI from .env
        const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/diploia';
        console.log(`Connecting to: ${URI}`);
        await mongoose.connect(URI);
        console.log('Connected!');

        // Clear existing data (optional, but good for clean migration)
        // Note: For safety, I'll only upsert or create.
        
        // 1. Migrate Nodes and AppState from nodes_data.json
        if (fs.existsSync(NODES_FILE)) {
            console.log('Migrating nodes_data.json...');
            const nodesData = JSON.parse(fs.readFileSync(NODES_FILE, 'utf8'));
            
            // Migrate individual nodes
            const nodeIds = Object.keys(nodesData.nodes || {});
            console.log(`Found ${nodeIds.length} nodes.`);
            
            for (const id of nodeIds) {
                const nodeData = nodesData.nodes[id];
                // Ensure id is present in the object
                nodeData.id = id;
                await Node.findOneAndUpdate({ id }, nodeData, { upsert: true, new: true });
            }
            console.log('Nodes migrated.');

            // Migrate AppState (metadata)
            const appStateData = {
                exportDate: nodesData.exportDate ? new Date(nodesData.exportDate) : new Date(),
                totalNodes: nodesData.totalNodes || 0,
                categories: nodesData.categories || [],
                categoryChildren: nodesData.categoryChildren || {},
                config: nodesData.config || {}
            };
            
            await AppState.findOneAndUpdate({}, appStateData, { upsert: true, new: true });
            console.log('AppState migrated.');
        }

        // 2. Migrate Rankings
        if (fs.existsSync(RANKING_FILE)) {
            console.log('Migrating ranking.json...');
            const rankingData = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
            const rankings = rankingData.rankings || [];
            
            for (const r of rankings) {
                const { id, ...cleanR } = r;
                // Avoid duplicates by checking name and score and date?
                // For simplicity, we'll just create.
                await Ranking.create(cleanR);
            }
            console.log('Rankings migrated.');
        }

        // 3. Migrate Ranking PV
        if (fs.existsSync(RANKING_PV_FILE)) {
            console.log('Migrating ranking_pv.json...');
            const rankingPVData = JSON.parse(fs.readFileSync(RANKING_PV_FILE, 'utf8'));
            const rankingsPV = rankingPVData.rankings || [];
            
            for (const r of rankingsPV) {
                const { id, ...cleanR } = r;
                await RankingPV.create(cleanR);
            }
            console.log('Rankings PV migrated.');
        }

        // 4. Migrate Space Config
        if (fs.existsSync(SPACE_CONFIG_FILE)) {
            console.log('Migrating space_config.json...');
            const spaceConfigData = JSON.parse(fs.readFileSync(SPACE_CONFIG_FILE, 'utf8'));
            await SpaceConfig.findOneAndUpdate({}, spaceConfigData, { upsert: true, new: true });
            console.log('SpaceConfig migrated.');
        }
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
