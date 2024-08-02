import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "Canarails",
      social: {
        github: "https://github.com/sheason2019/canarails_go",
      },
      sidebar: [
        {
          label: "起步",
          items: [
            // Each item here is one entry in the navigation menu.
            { slug: "guides/introduction" },
            { slug: "guides/install" },
            { slug: "guides/getstarted" },
            { slug: "guides/canary" },
            { slug: "guides/use_with_git" },
          ],
        },
      ],
    }),
  ],
});
