require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Node = require('../models/Node');
const AppState = require('../models/AppState');
const SpaceConfig = require('../models/SpaceConfig');
const Ranking = require('../models/Ranking');
const RankingPV = require('../models/RankingPV');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/diploia';

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Create default project
        let project = await Project.findOne({ id: 'diplomatura' });
        if (!project) {
            project = await Project.create({
                id: 'diplomatura',
                name: 'Diplomatura IA',
                description: 'Proyecto original de la diplomatura IA'
            });
            console.log('Created diplomatura project');
        }

        // 2. Update all Nodes
        const nodesUpdate = await Node.updateMany(
            { projectId: { $exists: false } },
            { $set: { projectId: 'diplomatura' } }
        );
        console.log(`Updated ${nodesUpdate.modifiedCount} nodes`);

        // 3. Update AppState
        const stateUpdate = await AppState.updateMany(
            { projectId: { $exists: false } },
            { $set: { projectId: 'diplomatura' } }
        );
        console.log(`Updated ${stateUpdate.modifiedCount} app states`);

        // 4. Update SpaceConfig
        const spaceUpdate = await SpaceConfig.updateMany(
            { projectId: { $exists: false } },
            { $set: { projectId: 'diplomatura' } }
        );
        console.log(`Updated ${spaceUpdate.modifiedCount} space configs`);

        // 5. Update Rankings
        const rankingUpdate = await Ranking.updateMany(
            { projectId: { $exists: false } },
            { $set: { projectId: 'diplomatura' } }
        );
        console.log(`Updated ${rankingUpdate.modifiedCount} rankings`);

        const rankingPVUpdate = await RankingPV.updateMany(
            { projectId: { $exists: false } },
            { $set: { projectId: 'diplomatura' } }
        );
        console.log(`Updated ${rankingPVUpdate.modifiedCount} rankings PV`);

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
