const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');

admin.initializeApp();

const storage = new Storage();
const bucketName = 'greyhatnews-d2e68.appspot.com'; // This should match your actual bucket path

exports.generateHugoContent = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const db = admin.firestore();
    const postsRef = db.collection('post');
    const snapshot = await postsRef.where('draft', '==', false).get();

    if (snapshot.empty) {
        console.log('No matching documents.');
        res.send('No matching documents.');
        return;
    }

    try {
        for (const doc of snapshot.docs) {
            const post = doc.data();
            const date = post.date.toDate();
            const year = date.getFullYear();
            const content = generateMarkdown(post);
            const filePath = `${year}/${post.slug}.md`;  // Define the path in the bucket
            await uploadMarkdownToStorage(content, filePath);
            console.log(`Uploaded file at ${filePath}`);
        }
        res.send('Markdown files uploaded successfully.');
    } catch (error) {
        console.error('Failed to upload markdown:', error);
        res.status(500).send('Error uploading markdown files');
    }
});

async function uploadMarkdownToStorage(content, filePath) {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    try {
        await file.save(content);
        console.log(`File ${filePath} saved to bucket.`);
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;  // Rethrow to handle it in the calling function
    }
}

function generateMarkdown(post) {
    const frontMatter = `---
title: "${post.title}"
date: ${post.date.toDate().toISOString()}
slug: "${post.slug}"
description: "${post.description}"
image: "${post.image}"
caption: "${post.caption}"
categories:
${post.categories.map(cat => `  - ${cat}`).join('\n')}
tags:
${post.tags.map(tag => `  - ${tag}`).join('\n')}
draft: ${post.draft}
---

${post.content}  // Directly using content as a string
`;
    return frontMatter;
}
