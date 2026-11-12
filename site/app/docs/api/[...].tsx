import { slugs } from "../content";

export { Page } from "../[...]";

export const paths = () => slugs().filter(slug => /^api(\/|$)/.test(slug)).map(slug => `/docs/${slug}`);
