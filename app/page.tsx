import { redirect } from "next/navigation";

// Guests only ever need /join. Host pages (/wall, /admin) are not linked from here.
export default function Home() {
  redirect("/join");
}
