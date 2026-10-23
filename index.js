import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

const parser = new Parser({
timeout: 15000,
headers: {
"User-Agent": "KabarNusa/1.0"
}
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
console.error("Konfigurasi Supabase belum lengkap.");
process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const feeds = [
{
name: "ANTARA",
url: "https://www.antaranews.com/rss/terkini.xml"
},
{
name: "BBC Indonesia",
url: "https://feeds.bbci.co.uk/indonesia/rss.xml"
},
{
name: "Google News",
url: "https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id"
}
];

function cleanText(value = "") {
return String(value)
.replace(/<[^>]*>/g, " ")
.replace(/\s+/g, " ")
.trim()
.slice(0, 1000);
}

function getCategory(title = "") {
const text = title.toLowerCase();

if (/ekonomi|bisnis|rupiah|saham|harga|bank/.test(text)) {
return "Ekonomi";
}

if (/teknologi|digital|ai |artificial intelligence|internet/.test(text)) {
return "Teknologi";
}

if (/sepak bola|olahraga|liga|timnas|badminton/.test(text)) {
return "Olahraga";
}

if (/dunia|amerika|china|tiongkok|jepang|eropa/.test(text)) {
return "Dunia";
}

if (/politik|pemilu|presiden|menteri|dpr/.test(text)) {
return "Politik";
}

return "Nasional";
}

async function main() {
let saved = 0;
let failedFeeds = 0;

for (const feed of feeds) {
try {
console.log("Mengambil berita dari ${feed.name}...");

  const result = await parser.parseURL(feed.url);

  for (const item of result.items.slice(0, 30)) {
    const title = cleanText(item.title);
    const sourceUrl = item.link?.trim();

    if (!title || !sourceUrl) continue;

    const publishedAt = item.isoDate || item.pubDate || null;
    const parsedDate = publishedAt
      ? new Date(publishedAt)
      : null;

    const validDate =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : null;

    const article = {
      title,
      summary: cleanText(item.contentSnippet || item.content || ""),
      source_name: feed.name,
      source_url: sourceUrl,
      category: getCategory(title),
      published_at: validDate
    };

    const { error } = await supabase
      .from("news")
      .upsert(article, {
        onConflict: "source_url",
        ignoreDuplicates: true
      });

    if (error) {
      console.error("Gagal menyimpan berita:", error.message);
      continue;
    }

    saved++;
  }
} catch (error) {
  failedFeeds++;
  console.error(
    `Sumber ${feed.name} gagal:`,
    error.message
  );
}

}

console.log("Proses selesai. Berita diproses: ${saved}");
console.log("Sumber RSS gagal: ${failedFeeds}");

if (failedFeeds === feeds.length) {
throw new Error("Semua sumber RSS gagal diakses.");
}
}

main().catch((error) => {
console.error("Proses pengambilan berita gagal:", error);
process.exit(1);
});
