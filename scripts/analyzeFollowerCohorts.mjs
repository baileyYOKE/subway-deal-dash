// Analyze story athlete data by follower cohorts to find metrics that favor smaller accounts
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBV32CqL_r2LU3H_OEv3j5yoMmrN72hB3s",
    authDomain: "subway-deal-2-dash.firebaseapp.com",
    projectId: "subway-deal-2-dash",
    storageBucket: "subway-deal-2-dash.firebasestorage.app",
    messagingSenderId: "1090232835839",
    appId: "1:1090232835839:web:caac6f0bc6c4b4af5a06ab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Follower cohorts
const cohorts = [
    { name: 'Under 1,000', min: 0, max: 999 },
    { name: '1,000-2,000', min: 1000, max: 2000 },
    { name: '2,001-3,000', min: 2001, max: 3000 },
    { name: '3,001-5,000', min: 3001, max: 5000 },
    { name: '5,001-10,000', min: 5001, max: 10000 },
    { name: '10,000+', min: 10001, max: Infinity },
];

async function analyzeData() {
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const athletes = docSnap.exists() ? docSnap.data().athletes || [] : [];

    // Filter to story athletes with followers data
    const storyAthletes = athletes.filter(a =>
        a.campaign_type === 'story' && a.ig_followers > 0
    );

    console.log(`📊 Story athletes with follower data: ${storyAthletes.length}`);

    // Analyze each cohort
    console.log('\n📈 COHORT ANALYSIS\n');
    console.log('='.repeat(100));

    for (const cohort of cohorts) {
        const group = storyAthletes.filter(a =>
            a.ig_followers >= cohort.min && a.ig_followers <= cohort.max
        );

        if (group.length === 0) {
            console.log(`\n${cohort.name}: No athletes`);
            continue;
        }

        // Calculate metrics
        const totalViews = group.reduce((sum, a) => sum + (a.ig_story_1_views || 0), 0);
        const totalFollowers = group.reduce((sum, a) => sum + (a.ig_followers || 0), 0);
        const totalTaps = group.reduce((sum, a) => sum + (a.ig_story_1_taps || 0), 0);
        const totalReplies = group.reduce((sum, a) => sum + (a.ig_story_1_replies || 0), 0);
        const totalShares = group.reduce((sum, a) => sum + (a.ig_story_1_shares || 0), 0);
        const totalEngagements = totalTaps + totalReplies + totalShares;

        const avgViews = totalViews / group.length;
        const avgFollowers = totalFollowers / group.length;
        const avgTaps = totalTaps / group.length;
        const avgReplies = totalReplies / group.length;
        const avgShares = totalShares / group.length;

        // KEY METRICS THAT FAVOR SMALLER ACCOUNTS
        const viewsPerFollower = totalViews / totalFollowers; // Reach efficiency
        const engagementPerView = totalEngagements / totalViews; // Engagement rate
        const engagementPerFollower = totalEngagements / totalFollowers; // Engagement efficiency
        const viewToFollowerRatio = (totalViews / totalFollowers) * 100; // % of followers reached

        console.log(`\n📊 ${cohort.name} (${group.length} athletes)`);
        console.log('-'.repeat(60));
        console.log(`  Avg Followers: ${Math.round(avgFollowers).toLocaleString()}`);
        console.log(`  Avg Views: ${Math.round(avgViews).toLocaleString()}`);
        console.log(`  Total Views: ${totalViews.toLocaleString()}`);
        console.log(`  `);
        console.log(`  📈 EFFICIENCY METRICS (favor smaller accounts):`);
        console.log(`    Views per Follower: ${viewsPerFollower.toFixed(2)}x`);
        console.log(`    View-to-Follower %: ${viewToFollowerRatio.toFixed(1)}%`);
        console.log(`    Engagement per View: ${(engagementPerView * 100).toFixed(2)}%`);
        console.log(`    Engagement per Follower: ${(engagementPerFollower * 100).toFixed(3)}%`);
        console.log(`  `);
        console.log(`  📱 ENGAGEMENT BREAKDOWN:`);
        console.log(`    Avg Taps: ${avgTaps.toFixed(1)}`);
        console.log(`    Avg Replies: ${avgReplies.toFixed(1)}`);
        console.log(`    Avg Shares: ${avgShares.toFixed(1)}`);
    }

    // Summary comparison table
    console.log('\n\n📊 COMPARISON TABLE\n');
    console.log('Cohort          | Athletes | Avg Views | Views/Follower | Engagement Rate');
    console.log('-'.repeat(80));

    for (const cohort of cohorts) {
        const group = storyAthletes.filter(a =>
            a.ig_followers >= cohort.min && a.ig_followers <= cohort.max
        );
        if (group.length === 0) continue;

        const totalViews = group.reduce((sum, a) => sum + (a.ig_story_1_views || 0), 0);
        const totalFollowers = group.reduce((sum, a) => sum + (a.ig_followers || 0), 0);
        const totalEngagements = group.reduce((sum, a) =>
            sum + (a.ig_story_1_taps || 0) + (a.ig_story_1_replies || 0) + (a.ig_story_1_shares || 0), 0);

        const avgViews = totalViews / group.length;
        const viewsPerFollower = totalViews / totalFollowers;
        const engagementRate = totalEngagements / totalViews;

        console.log(
            `${cohort.name.padEnd(15)} | ${String(group.length).padStart(8)} | ${Math.round(avgViews).toLocaleString().padStart(9)} | ${viewsPerFollower.toFixed(2).padStart(14)}x | ${(engagementRate * 100).toFixed(2)}%`
        );
    }
}

analyzeData().catch(console.error);
