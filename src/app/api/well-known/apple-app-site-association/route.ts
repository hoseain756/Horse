import { NextResponse } from "next/server";

/**
 * iOS Universal Links association file (AASA), served with the
 * application/json content type Apple requires via a rewrite from
 * /.well-known/apple-app-site-association.
 *
 * The appID prefix must be the developer's Apple Team ID — replace
 * TEAMID_PLACEHOLDER after enabling Associated Domains
 * (applinks:<this-host>) on the App ID, and ship the app with that
 * entitlement.
 */
export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appIDs: ["TEAMID_PLACEHOLDER.app.noor.mobile"],
            components: [
              {
                path: "/",
              },
            ],
          },
        ],
      },
    },
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
