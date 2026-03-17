const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const DATA_PATH = 'data/entries.json';

export async function readEntries() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_PATH}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!res.ok) {
    if (res.status === 404) return { entries: [], sha: null };
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { entries: JSON.parse(content), sha: data.sha };
}

export async function writeEntries(entries, sha) {
  const content = Buffer.from(JSON.stringify(entries, null, 2)).toString('base64');

  const body = {
    message: 'Update entries',
    content,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub write failed: ${res.status} - ${err.message}`);
  }

  return res.json();
}