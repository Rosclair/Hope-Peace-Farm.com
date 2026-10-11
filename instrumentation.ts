// Appelé une fois par Next.js au démarrage du serveur, avant la première requête.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { demarrerServeur } = await import("./lib/serveur/demarrage");
    await demarrerServeur();
  }
}
