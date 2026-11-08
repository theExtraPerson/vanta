const r = await fetch("http://localhost:3000/register?code=TEST12");
const h = await r.text();
console.log("status", r.status);
const tags = h.match(/<title>[^<]*<\/title>|<meta[^>]+(?:name|property)="(?:description|og:title|og:description|og:image|twitter:title|twitter:description)"[^>]*>/g) || [];
tags.forEach((t) => console.log(t));
