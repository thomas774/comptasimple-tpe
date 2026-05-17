import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, BarChart3, Receipt, FileText, Banknote, Users, ShieldCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import dashboardImg from "@/assets/dashboard.png";
import invoiceImg from "@/assets/invoice.png";
import receiptImg from "@/assets/receipt-scan.png";

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-primary/20 selection:text-primary">
      
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <span className="font-bold text-xl tracking-tight">ComptaSimple TPE</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-primary transition-colors">Fonctionnalités</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Tarifs</a>
            <a href="#testimonials" className="hover:text-primary transition-colors">Témoignages</a>
          </nav>

          <div className="flex items-center gap-4">
            <a href="/sign-in" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">
              Se connecter
            </a>
            <a href="/sign-up">
              <Button className="bg-primary hover:bg-primary/90 text-white shadow-sm font-medium rounded-full px-6">
                Essayer gratuitement
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-slate-50/50 -z-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/5 rounded-bl-[100px] -z-10 blur-3xl opacity-50" />
        
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="outline" className="mb-6 py-1.5 px-4 rounded-full border-primary/20 bg-primary/5 text-primary">
                Conçu pour les entrepreneurs français
              </Badge>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1]">
                La comptabilité pour ceux qui ont <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">mieux à faire.</span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Simple. Précis. Français. Gagnez du temps sur l'administratif et concentrez-vous sur ce qui compte vraiment : votre entreprise.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <a href="/sign-up">
                  <Button size="lg" className="h-14 px-8 text-base rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all">
                    Démarrer gratuitement
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </a>
                <a href="#demo">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-full border-slate-200 hover:bg-slate-50">
                    <Play className="mr-2 w-5 h-5 text-slate-400" />
                    Voir la démo
                  </Button>
                </a>
              </div>
              <p className="text-sm text-slate-500">Aucune carte bancaire requise. Annulation à tout moment.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-20 relative mx-auto max-w-5xl"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 h-full" />
              <img 
                src={dashboardImg} 
                alt="ComptaSimple Dashboard" 
                className="rounded-2xl border border-slate-200 shadow-2xl w-full"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white relative">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Tout ce dont vous avez besoin, sans la complexité.</h2>
            <p className="text-lg text-slate-600">
              Des devis jusqu'à votre déclaration de TVA, nous automatisons le processus pour que vous soyez toujours en règle.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <FileText className="w-6 h-6 text-primary" />, title: "Devis & Factures", desc: "Créez des documents professionnels en 3 clics. Suivi des paiements intégré." },
              { icon: <Banknote className="w-6 h-6 text-primary" />, title: "Suivi des dépenses", desc: "Connectez votre banque ou saisissez manuellement vos frais professionnels." },
              { icon: <BarChart3 className="w-6 h-6 text-primary" />, title: "Tableau de bord", desc: "Suivez votre CA, votre TVA collectée et votre résultat en temps réel." },
              { icon: <ShieldCheck className="w-6 h-6 text-primary" />, title: "TVA & Déclarations", desc: "Estimations automatiques de votre CA3 pour ne jamais payer en retard." },
              { icon: <Receipt className="w-6 h-6 text-primary" />, title: "Scan OCR IA", desc: "Prenez en photo vos reçus, notre IA extrait automatiquement les données." },
              { icon: <Users className="w-6 h-6 text-primary" />, title: "Multi-utilisateurs", desc: "Invitez votre expert-comptable ou vos associés en toute sécurité." },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:border-primary/20 transition-colors"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 border border-slate-100">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Highlight 1 */}
      <section className="py-24 bg-slate-50 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="secondary" className="mb-4 text-primary bg-primary/10">Facturation</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Des factures qui se font payer plus vite.</h2>
                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  Notre éditeur de factures est si simple que vous n'y penserez même pas. Envoyez des liens de paiement, programmez des relances automatiques et voyez l'argent arriver directement sur votre compte.
                </p>
                <ul className="space-y-4">
                  {['Création rapide en PDF', 'Relances automatiques', 'Suivi des vues'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span className="text-slate-700 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
            <div className="lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <img src={invoiceImg} alt="Facturation Simple" className="rounded-2xl border border-slate-200 shadow-xl" />
                <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-lg border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Facture payée !</p>
                    <p className="text-xs text-slate-500">Il y a 2 minutes</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlight 2 */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <img src={receiptImg} alt="Scan de reçus" className="rounded-2xl border border-slate-200 shadow-xl max-w-sm mx-auto" />
              </motion.div>
            </div>
            <div className="lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="secondary" className="mb-4 text-primary bg-primary/10">Intelligence Artificielle</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Ne saisissez plus jamais un ticket de caisse.</h2>
                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  Prenez simplement votre reçu en photo. Notre IA se charge de lire le montant, la TVA et le fournisseur pour les classer automatiquement.
                </p>
                <ul className="space-y-4">
                  {['Reconnaissance OCR ultra-précise', 'Catégorisation automatique', 'Rapprochement bancaire en 1 clic'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span className="text-slate-700 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Des tarifs clairs, sans mauvaise surprise.</h2>
            <p className="text-lg text-slate-400">
              Choisissez l'offre adaptée à la taille de votre entreprise. 
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            {/* Starter Plan */}
            <Card className="bg-slate-800 border-slate-700 p-8 rounded-3xl text-white">
              <div className="mb-6">
                <h3 className="text-xl font-medium text-slate-300 mb-2">Starter</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">9 €</span>
                  <span className="text-slate-400">/mois</span>
                </div>
                <p className="text-sm text-slate-400">Pour les micro-entrepreneurs qui se lancent.</p>
              </div>
              <ul className="space-y-4 mb-8">
                {['Devis & factures illimités', 'Suivi des dépenses', 'Tableau de bord simple', 'Export CSV/PDF'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-slate-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="/sign-up">
                <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-full">Commencer Starter</Button>
              </a>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-primary border-primary p-8 rounded-3xl text-white relative shadow-2xl shadow-primary/20 scale-105 z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Recommandé
              </div>
              <div className="mb-6 mt-2">
                <h3 className="text-xl font-medium text-blue-100 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">19 €</span>
                  <span className="text-blue-200">/mois</span>
                </div>
                <p className="text-sm text-blue-100">Le meilleur point d'entrée pour la majorité.</p>
              </div>
              <ul className="space-y-4 mb-8">
                {['TVA estimée', 'Rapprochement bancaire', 'Multi-utilisateurs', 'Relances automatiques', 'Exports comptables'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white">
                    <CheckCircle2 className="w-4 h-4 text-blue-300" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="/sign-up">
                <Button className="w-full bg-white hover:bg-slate-100 text-primary rounded-full">Démarrer l'essai gratuit</Button>
              </a>
            </Card>

            {/* Business Plan */}
            <Card className="bg-slate-800 border-slate-700 p-8 rounded-3xl text-white">
              <div className="mb-6">
                <h3 className="text-xl font-medium text-slate-300 mb-2">Business</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">39 €</span>
                  <span className="text-slate-400">/mois</span>
                </div>
                <p className="text-sm text-slate-400">Pour les TPE structurées et en croissance.</p>
              </div>
              <ul className="space-y-4 mb-8">
                {['Automatisations IA', 'OCR factures & reçus', 'Prévision trésorerie', 'API bancaire directe', 'Accès expert-comptable'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-slate-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="/sign-up">
                <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-full">Commencer Business</Button>
              </a>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-24 bg-primary text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-6">Prêt à reprendre le contrôle ?</h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Rejoignez des milliers d'entrepreneurs qui ont arrêté de stresser pour leur comptabilité.
          </p>
          <a href="/sign-up">
            <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-white text-primary hover:bg-slate-50 shadow-xl transition-all">
              Créer mon compte gratuitement
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 py-12 border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">
                  C
                </div>
                <span className="font-bold text-lg">ComptaSimple</span>
              </div>
              <p className="text-slate-500 text-sm max-w-sm">
                Le logiciel de comptabilité pensé pour les petites entreprises françaises. Simple, précis et conforme.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-slate-900">Produit</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#features" className="hover:text-primary">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-primary">Tarifs</a></li>
                <li><a href="/sign-in" className="hover:text-primary">Connexion</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-slate-900">Légal</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#" className="hover:text-primary">Mentions légales</a></li>
                <li><a href="#" className="hover:text-primary">CGV</a></li>
                <li><a href="#" className="hover:text-primary">Confidentialité</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
            <p>© {new Date().getFullYear()} ComptaSimple. Tous droits réservés.</p>
            <p>Fait avec passion en France.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
