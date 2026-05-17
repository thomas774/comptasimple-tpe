import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/ocr/receipt", requireAuth, async (req, res): Promise<void> => {
  const { image, mimeType } = req.body as { image?: string; mimeType?: string };

  if (!image || !mimeType) {
    res.status(400).json({ error: "image and mimeType are required" });
    return;
  }

  const prompt = `Tu es un expert-comptable français. Analyse ce justificatif (ticket de caisse, facture, ou reçu) et extrais les informations fiscales suivantes.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication, avec exactement ces champs :
{
  "vatRate": <taux de TVA en nombre (0, 5.5, 10, ou 20) ou null si non applicable>,
  "amountHT": <montant HT en nombre ou null>,
  "amountTTC": <montant TTC en nombre ou null>,
  "vatAmount": <montant de TVA en nombre ou null>,
  "supplier": <nom du fournisseur ou null>,
  "date": <date au format YYYY-MM-DD ou null>,
  "category": <catégorie parmi: "Frais généraux","Télécom","Matériel","Logiciels","Loyer","Énergie","Assurance","Véhicule","Frais bancaires","Charges sociales","Publicité","Déplacements","Restauration","Sous-traitance","Fournitures","Formation","Autre" ou null>
}

Règles importantes :
- En France les taux de TVA sont 0%, 5.5%, 10%, 20%
- Si plusieurs taux de TVA sont présents, utilise le taux dominant (le plus élevé ou celui avec le plus grand montant)
- Si aucune TVA n'est visible ou applicable, mettre vatRate à null
- Pour les billets de transport, carburant : 20% (ou 5.5% pour les transports en commun)
- Pour la restauration : 10%
- Pour les produits alimentaires de base : 5.5%
- Pour les services professionnels : 20%`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${image}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      parsed = {};
    }

    res.json({
      vatRate: parsed.vatRate ?? null,
      amountHT: parsed.amountHT ?? null,
      amountTTC: parsed.amountTTC ?? null,
      vatAmount: parsed.vatAmount ?? null,
      supplier: parsed.supplier ?? null,
      date: parsed.date ?? null,
      category: parsed.category ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "OCR receipt error");
    res.status(500).json({ error: "OCR analysis failed" });
  }
});

export default router;
