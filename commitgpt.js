#!/usr/bin/env node

import { OpenAI } from "openai";
import simpleGit from "simple-git";

const config = {
	commitLengthFilter: 20,
	model: "gpt-3.5-turbo-16k",
	temperature: 1
}

const apiKey = process.env.OPENAI_KEY;
if (!apiKey) {
	console.error("OPENAI_KEY env var not found");
	process.exit();
}
const openai = new OpenAI({apiKey});

async function askGPT(question) {

	try {
		const result = await openai.chat.completions.create({
			model: config.model,
			temperature: config.temperature,
			messages: [
				{role: 'user', content: question}
			]
		});
		return result.choices[0].message.content;
	} catch (error) {
		console.error(error.message || 'An error occurred during OpenAI request: ' + error);
		throw error;
	}
}

//hooks

(async () => {
	let hashes = [];
	const args = process.argv.at(2) || "";

	if (args.indexOf('--history') >= 0) {
		hashes = (await simpleGit().log()).all.filter(log => log.message.length < config.commitLengthFilter).map(log => log.hash);
	} else if (args.indexOf('--hashes') >= 0) {
		const all = (await simpleGit().log()).all;
		for (const ha of args.replace("--hashes=", "").split(",")) {
			hashes.push(all.find(log => log.hash === ha).hash)
		}
	} else {
		hashes.push(null);
	}

	if (hashes.length < 1) {
		console.log("No hash founded to be rewrite");
	}

	for (const hash of hashes) {
		const opt = {};
		opt[hash] = null;

		const diff = await simpleGit().diff(opt);
		const question = `Following this JSON format : {"title": "<type>[scope]: Summary of commit if small commit or 'Complex commit' for long ones", "description": "/*Full detailed commit description in markdown*/"}, give me the response for this git diff: \`\`\`${diff}\`\`\``;
		const possibilities = await askGPT(question);

		await simpleGit().checkout(hash);
		await simpleGit().commit(possibilities, {'--amend': null});
	}
})();
