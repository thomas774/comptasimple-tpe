import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/ai/chat", requireAuth, async (req, res): Promise<void> => {
  const { messages, context } = req.body as {
    messages?: { role: string; content: string }[];
    context?: {
      company?: { name: string; siret: string; vatNumber: string; legalForm: string };
      summary?: {
        caHT: number;
        achatsHT: number;
        tvaDue: number;
        invoiceCount: number;
        expenseCount: number;
        clientCount: number;
        currentYear: number;
      };
    };
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const companyName = context?.company?.name || "l'entreprise";
  const siret = context?.company?.siret ? `SIRET ${context.company.siret}` : "";
  const vatNumber = context?.company?.vatNumber ? `N° TVA ${context.company.vatNumber}` : "";
  const legalForm = context?.company?.legalForm || "";
  const year = context?.summary?.currentYear ?? new Date().getFullYear();
  const caHT = context?.summary?.caHT ?? 0;
  const achatsHT = context?.summary?.achatsHT ?? 0;
  const tvaDue = context?.summary?.tvaDue ?? 0;
  const invoiceCount = context?.summary?.invoiceCount ?? 0;
  const expenseCount = context?.summary?.expenseCount ?? 0;
  const clientCount = context?.summary?.clientCount ?? 0;

  const systemPrompt = `Tu es un expert-comptable français virtuel intégré à ComptaSimple, un logiciel de comptabilité pour TPE/PME.

**Entreprise cliente :** ${companyName} ${legalForm ? `(${legalForm})` : ""} ${siret} ${vatNumber}

**Données comptables ${year} :**
- Chiffre d'affaires HT : ${caHT.toLocaleString("fr-FR")} €
- Achats/dépenses HT : ${achatsHT.toLocaleString("fr-FR")} €
- Résultat estimé : ${(caHT - achatsHT).toLocaleString("fr-FR")} €
- TVA due estimée : ${tvaDue.toLocaleString("fr-FR")} €
- Nombre de factures : ${invoiceCount}
- Nombre de dépenses : ${expenseCount}
- Nombre de clients : ${clientCount}

**Tes capacités :**
- Générer des déclarations fiscales françaises (DAS2, CA3, CA12, IS, 2035…)
- Expliquer les règles comptables et fiscales françaises
- Analyser les données financières de l'entreprise
- Aider à la saisie comptable, aux écritures, au plan comptable
- Conseiller sur la TVA, les charges sociales, l'optimisation fiscale
- Rédiger des documents comptables (lettre à l'URSSAF, mises en demeure…)
- Expliquer le Plan Comptable Général (PCG)

**Format de tes réponses :**
- Sois précis, professionnel et concis
- Utilise des tableaux, listes et titres Markdown quand c'est utile
- Pour les déclarations, génère un document structuré avec toutes les cases remplies
- Toujours indiquer les références légales (articles CGI, BOFiP) quand pertinent
- Si des données manquent pour compléter une déclaration, indique clairement quels chiffres sont nécessaires
- Réponds TOUJOURS en français`;

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    res.write(`data: ${JSON.stringify({ error: "Erreur lors de la génération de la réponse." })}\n\n`);
    res.end();
  }
});

export default router;
