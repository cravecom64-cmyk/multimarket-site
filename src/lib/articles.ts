import articlesData from "@/data/articles.json";

export type Article = {
  slug: string;
  title: string;
  description: string;
  published: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string }[];
};

export const articles = articlesData as Article[];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
