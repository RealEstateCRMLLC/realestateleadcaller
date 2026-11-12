import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin Turbopack root to this repo: without it Next walks up past the
  // submodule boundary and infers the parent CRM repo as workspace root,
  // then compiles the parent's src/instrumentation + email-config (missing
  // @aws-sdk/client-ses/nodemailer in this app). Same fix as
  // foreclosureworkflow 357b3eb.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
