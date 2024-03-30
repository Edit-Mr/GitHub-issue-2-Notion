/** @format */

const request = require("request");
require("dotenv").config();
const {markdownToBlocks} = require('@tryfabric/martian');

async function main() {
    // Get environment variables
    const repo = process.env["GITHUB_OWNER"] + "/" + process.env["GITHUB_REPO"];
    const notionDatabaseId = process.env["NOTION_DATABASE_ID"];
    const notionToken = process.env["NOTION_API_KEY"];

    // Get all issues from the public repository
    const issuesUrl = `https://api.github.com/repos/${repo}/issues`;
    // use GET request to get all issues
    const issuesResponse = await new Promise((resolve, reject) => {
        request(
            {
                url: issuesUrl,
                method: "GET",
                headers: {
                    "User-Agent": "request",
                },
            },
            (error, response, body) => {
                if (error) {
                    reject(error);
                }
                resolve(JSON.parse(body));
            }
        );
    });
    for (const issue of issuesResponse) {
        const issueId = issue.id;
        const notionUrl = `https://api.notion.com/v1/databases/${notionDatabaseId}/query`;
        const notionResponse = await new Promise((resolve, reject) => {
            request(
                {
                    url: notionUrl,
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${notionToken}`,
                        "Notion-Version": "2022-06-28",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        filter: {
                            property: "ID",
                            number: {
                                equals: issueId,
                            },
                        },
                    }),
                },
                (error, response, body) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(JSON.parse(body));
                }
            );
        });

        if (notionResponse.results.length > 0) {
            console.log(`Issue ${issueId} already exists in Notion`);
        } else {
            console.log(`Creating new issue ${issueId} in Notion`);
            // Create a new issue in Notion
            const createUrl = `https://api.notion.com/v1/pages`;
            // for body add property thtle, ID, title, State, labels, and put description in content
            const createResponse = await new Promise((resolve, reject) => {
                request(
                    {
                        url: createUrl,
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${notionToken}`,
                            "Content-Type": "application/json",
                            "Notion-Version": "2022-06-28",
                        },
                        body: JSON.stringify({
                            parent: { database_id: notionDatabaseId },
                            icon: {
                                emoji: "⚡",
                            },
                            properties: {
                                Name: {
                                    title: [
                                        {
                                            text: {
                                                content: issue.title,
                                            },
                                        },
                                    ],
                                },
                                ID: {
                                    number: issueId,
                                },
                                State: {
                                    select: {
                                        name: "Open",
                                    },
                                },
                                Status: {
                                    status: {
                                        name: "Not started",
                                    },
                                },
                                Labels: {
                                    multi_select: issue.labels.map(label => {
                                        return {
                                            name: label.name,
                                        };
                                    }),
                                },
                                URL: {
                                    url: issue.html_url,
                                },
                            },
                            children: issue.body != null ? markdownToBlocks(issue.body) : [],
                        }),
                    },
                    (error, response, body) => {
                        console.log(body);
                        if (error) {
                            reject(error);
                        }
                        resolve(JSON.parse(body));
                        return;
                    }
                );
            });
            console.log(`Issue ${issueId} created in Notion`);
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
