import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import TopNavBar from "@/components/topNavBar/topNavBar";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className={styles.page}>
      <TopNavBar />
      <div className={styles.container}>
        <p className={styles.placeholder}>Settings will appear here.</p>
      </div>
    </main>
  );
}