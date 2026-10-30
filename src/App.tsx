import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XChart, YAxis, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Bot, FileText, AlertTriangle, ShieldCheck, CheckCircle2, XCircle, Search, Upload, Filter, UserCheck, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Layers, History, Scale, Building2, Send, ChevronRight, Eye, Download, Info
} from 'lucide-react';

// --- MOCK BUDGET DATA ---
const INITIAL_BUDGET_METRICS = {
  totalBudget: 6740.1, // Billions FCFA
  executionRate: 48.2, // % at Mid-Year
  totalRevenues: 3210.5,
  totalExpenditures: 3250.0,
  detectedAnomaliesCount: 4,
  pendingAlertsCount: 3
};

const MINISTRY_EXECUTION_DATA = [
  { name: "Santé Publique", vote: 320.5, execute: 145.2, rate: 45.3, status: "Vigilance" },
  { name: "Éducation de Base", vote: 410.0, execute: 215.8, rate: 52.6, status: "Normal" },
  { name: "Travaux Publics", vote: 580.4, execute: 220.1, rate: 37.9, status: "Sous-exécution" },
  { name: "Eau & Énergie", vote: 210.2, execute: 125.6, rate: 59.8, status: "Normal" },
  { name: "Agriculture", vote: 195.0, execute: 72.0, rate: 36.9, status: "Sous-exécution" },
  { name: "Défense", vote: 450.0, execute: 280.5, rate: 62.3, status: "Accéléré" }
];

const HISTORICAL_TRENDS = [
  { year: '2022', prevision: 5750, execution: 5420 },
  { year: '2023', prevision: 6325, execution: 6100 },
  { year: '2024', prevision: 6740, execution: 3250 }, // Mid-year
  { year: '2025 (Proj)', prevision: 7120, execution: 0 },
];

const INITIAL_ALERTS = [
  {
    id: "ALT-2024-001",
    document: "MINFI - Rapport d'exécution T2 2024",
    section: "Page 9-10, Tableau 2 & Chapitre 3.1",
    ministry: "Finances / Impôts",
    type: "Incohérence Documentaire",
    severity: "Haute",
    description: "Le texte commente un taux de réalisation de 95,2% pour les droits d'enregistrement (41,4 milliards), alors que le Tableau 2 indique 41,5 milliards sur une prévision de 108,3 milliards, soit un taux réel de 38,3%.",
    status: "En attente", // "En attente", "Vérifié", "Rejeté"
    detectedAt: "2024-10-24 14:32"
  },
  {
    id: "ALT-2024-002",
    document: "Projet de Loi de Finances 2024 - Annexe 4",
    section: "Page 142, Ligne 402",
    ministry: "Travaux Publics",
    type: "Sous-exécution Sévère",
    severity: "Moyenne",
    description: "Le programme 074 (Infrastructures Routières) affiche un taux d'engagement des dépenses d'investissement de seulement 22.4% au terme du premier semestre.",
    status: "En attente",
    detectedAt: "2024-10-25 09:15"
  },
  {
    id: "ALT-2024-003",
    document: "Rapport d'Exécution Budgétaire T2 2024",
    section: "Page 45, Tableau Synthese BIP",
    ministry: "Santé Publique",
    type: "Ecart Prevision/Réalisation",
    severity: "Haute",
    description: "Consommation accélérée des crédits de fonctionnement (78%) en contraste avec la faible réalisation des projets d'équipement des hôpitaux régionaux (19%).",
    status: "En attente",
    detectedAt: "2024-10-26 11:45"
  }
];

const INITIAL_AUDIT_LOGS = [
  { id: 101, timestamp: "2024-10-26 14:10", user: "IA (Système Automatique)", action: "Ingestion & Extraction OCR", detail: "Traitement du fichier MINFI_Rapport_T2_2024.pdf (119 pages)", status: "Succès" },
  { id: 102, timestamp: "2024-10-26 14:12", user: "IA (Moteur d'Alerte)", action: "Détection d'Incohérence", detail: "Génération de l'alerte ALT-2024-001 (Droits d'enregistrement)", status: "Généré" },
  { id: 103, timestamp: "2024-10-26 15:30", user: "M. Binam (Admin Parlementaire)", action: "Vérification Documentaire", detail: "Consultation du document source original - Confirmation de l'écart de calcul", status: "En cours" }
];

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'agent', 'documents', 'alerts', 'audit'
  const [userRole, setUserRole] = useState('Administrateur'); // 'Administrateur', 'Rapporteur', 'Membre Commission'
  
  // Dashboard & Filter States
  const [exerciseYear, setExerciseYear] = useState('2024');
  const [selectedMinistry, setSelectedMinistry] = useState('Tous');

  // Alert State
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // Chatbot / Agent IA State
  const [messages, setMessages] = useState([
    {
      sender: 'agent',
      text: "Bonjour. Je suis l'Agent IA d'assistance au contrôle budgétaire de l'Assemblée Nationale. Je peux analyser les lois de finances, comparer les rapports d'exécution trimestriels, détecter les anomalies documentaires et générer des notes de synthèse.",
      sources: []
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalysing]);

  // Handle Alert Validation/Rejection by Human
  const handleVerifyAlert = (alertId, newStatus) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: newStatus } : a));
    
    // Add Audit Log
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: `Utilisateur (${userRole})`,
      action: newStatus === 'Vérifié' ? 'Validation d\'Alerte' : 'Rejet d\'Alerte',
      detail: `Décision sur l'alerte ${alertId} transmise pour travaux de commission`,
      status: newStatus
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // AI Prompt Handlers
  const handleSendPrompt = (promptText) => {
    const query = promptText || inputQuery;
    if (!query.trim()) return;

    // Add User Message
    const userMsg = { sender: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsAnalysing(true);

    // Simulate AI Agent Process with Domain-Specific Cameroon/Parliamentary Reasoning
    setTimeout(() => {
      let agentResponse = { sender: 'agent', text: '', sources: [] };

      const lowerQ = query.toLowerCase();
      if (lowerQ.includes('santé') || lowerQ.includes('sante')) {
        agentResponse.text = "Analyse du Ministère de la Santé Publique (Exercice 2024 - Mid-Year) :\n\n" +
          "• Crédits votés : 320,5 milliards FCFA.\n" +
          "• Dépenses exécutées : 145,2 milliards FCFA (Taux global : 45,3%).\n" +
          "• Point d'attention : On observe une forte asymétrie entre les dépenses de fonctionnement (78% consommés) et le Budget d'Investissement Public (BIP) exécuté à seulement 19% sur le terrain.\n" +
          "• Recommandation : Auditionner le responsable du Programme 056 sur les goulots d'étranglement de la passation des marchés d'équipements sanitaires.";
        agentResponse.sources = [
          { doc: "Projet de Loi de Finances 2024", page: "Tome II - p. 112" },
          { doc: "Rapport Exécution MINFI T2 2024", page: "Tableau BIP - p. 45" }
        ];
      } else if (lowerQ.includes('écart') || lowerQ.includes('ecart') || lowerQ.includes('t2 2024') || lowerQ.includes('anomalie')) {
        agentResponse.text = "Incohérence majeure détectée dans le Rapport d'Exécution T2 2024 (MINFI) :\n\n" +
          "• Secteur : Recettes fiscales / Droits d'enregistrement (pp. 9-10, Tab 2).\n" +
          "• Erreur relevée : Le commentaire textuel fait état d'un taux de réalisation de 95,2% (41,4 milliards), alors que le tableau officiel indique un objectif de 108,3 milliards et une réalisation de 41,5 milliards, soit un taux réel récalculé de 38,3%.\n" +
          "• Impact : Écart documentaire susceptible d'induire en erreur l'évaluation de la commission. L'alerte ALT-2024-001 a été émise et attend votre validation humaine.";
        agentResponse.sources = [
          { doc: "Rapport d'exécution du Budget MINFI à fin juin 2024", page: "pp. 9-10, Tableau 2" }
        ];
      } else if (lowerQ.includes('note') || lowerQ.includes('briefing') || lowerQ.includes('commission')) {
        agentResponse.text = "SYNTHÈSE DE BRIEFING POUR LA COMMISSION DES FINANCES ET DU BUDGET :\n\n" +
          "1. Taux global d'exécution budgétaire à mi-parcours : 48,2% (Conforme aux prévisions saisonnières).\n" +
          "2. Risque de Sous-Exécution : Travaux Publics (37,9%) et Agriculture (36,9%).\n" +
          "3. Risque d'Incohérence : Recettes des droits d'enregistrement sous-évaluées dans le récit T2.\n" +
          "4. Actions suggérées : Demander au MINFI la rectification du Tableau 2 et saisir le Ministère des Travaux Publics sur les retards de paiement des décomptes des PME.";
        agentResponse.sources = [
          { doc: "Compilation Analytique Assemblée Nationale", page: "Synthèse IA Auto-Générée" }
        ];
      } else {
        agentResponse.text = "J'ai parcouru le corpus documentaire budgétaire (Lois de finances, Rapports trimestriels MINFI, Comptes Administratifs).\n\n" +
          `A la question "${query}", les données indiquent un alignement global des dépenses ordonnancées avec un taux moyen d'exécution de 48.2% pour l'exercice ${exerciseYear}. Les écarts majeurs concernent principalement 2 programmes d'investissement prioritaire. Vous pouvez consulter l'onglet 'Alertes & Anomalies' pour vérifier les lignes spécifiques.`;
        agentResponse.sources = [
          { doc: `Base de données Budgétaire Assemblée (${exerciseYear})`, page: "Multi-sources" }
        ];
      }

      setMessages(prev => [...prev, agentResponse]);
      setIsAnalysing(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased">
      {/* --- TOP HEADER / NAVIGATION --- */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Branding & Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                <Scale className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
                  PARLA-BUDGET <span className="bg-emerald-950 text-emerald-400 border border-emerald-700 text-xs px-2 py-0.5 rounded-full font-mono">IA SOUVERAINE</span>
                </h1>
                <p className="text-xs text-slate-400">Système Parlementaire d'Analyse & Contrôle Budgétaire</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex space-x-1">
              {[
                { id: 'dashboard', label: 'Tableau de Bord', icon: Layers },
                { id: 'agent', label: 'Agent IA & Briefing', icon: Bot },
                { id: 'alerts', label: 'Alertes & Anomalies', icon: AlertTriangle, badge: alerts.filter(a => a.status === 'En attente').length },
                { id: 'documents', label: 'Corpus Documentaire', icon: FileText },
                { id: 'audit', label: 'Traçabilité & Journal', icon: History }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                      isActive 
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="bg-amber-500 text-slate-950 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-1">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Role & Governance Selector */}
            <div className="flex items-center space-x-3">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-400 ml-2" />
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="bg-transparent text-xs text-slate-300 font-medium border-none focus:ring-0 cursor-pointer pr-4"
                >
                  <option value="Administrateur" className="bg-slate-900 text-slate-200">Rôle: Admin Parlementaire</option>
                  <option value="Rapporteur" className="bg-slate-900 text-slate-200">Rôle: Rapporteur de Commission</option>
                  <option value="Membre Commission" className="bg-slate-900 text-slate-200">Rôle: Député / Membre</option>
                </select>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* GLOBAL FILTERS BAR */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2 text-slate-400 text-sm">
              <Filter className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-slate-300">Filtres Budgétaires :</span>
            </div>

            {/* Year */}
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400">Exercice:</span>
              <select 
                value={exerciseYear} 
                onChange={(e) => setExerciseYear(e.target.value)}
                className="bg-transparent text-xs text-emerald-400 font-semibold border-none focus:ring-0 cursor-pointer"
              >
                <option value="2024" className="bg-slate-900">2024 (En cours)</option>
                <option value="2023" className="bg-slate-900">2023 (Clôturé)</option>
                <option value="2022" className="bg-slate-900">2022 (Clôturé)</option>
              </select>
            </div>

            {/* Ministry */}
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400">Ministère / Section:</span>
              <select 
                value={selectedMinistry} 
                onChange={(e) => setSelectedMinistry(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-medium border-none focus:ring-0 cursor-pointer"
              >
                <option value="Tous" className="bg-slate-900">Tous les ministères</option>
                <option value="Santé Publique" className="bg-slate-900">MINSANTE - Santé Publique</option>
                <option value="Travaux Publics" className="bg-slate-900">MINTP - Travaux Publics</option>
                <option value="Éducation de Base" className="bg-slate-900">MINEDUB - Éducation Base</option>
                <option value="Finances" className="bg-slate-900">MINFI - Finances</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Infrastructure Sécurisée en Réseau Fermé</span>
          </div>
        </div>

        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Enveloppe Budgétaire Globale</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{INITIAL_BUDGET_METRICS.totalBudget.toLocaleString()} <span className="text-sm font-normal text-slate-400">Mds FCFA</span></h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-emerald-400">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                  <span>+6.5% vs Exercice 2023</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Taux d'Exécution (Mid-Year)</p>
                    <h3 className="text-2xl font-bold text-emerald-400 mt-1">{INITIAL_BUDGET_METRICS.executionRate}%</h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-4 w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${INITIAL_BUDGET_METRICS.executionRate}%` }}></div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Incohérences & Écarts Détectés</p>
                    <h3 className="text-2xl font-bold text-amber-400 mt-1">{alerts.length} <span className="text-xs font-normal text-slate-400">Alertes</span></h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs text-amber-400">
                  <span>{alerts.filter(a => a.status === 'En attente').length} nécessitent validation humaine</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Documents Ingestés</p>
                    <h3 className="text-2xl font-bold text-white mt-1">28 <span className="text-xs font-normal text-slate-400">Rapports/Lois</span></h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  <span>Dernière synchro: MINFI T2 2024</span>
                </div>
              </div>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chart 1: Sector Execution Rates */}
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="font-bold text-slate-200">Exécution Budgétaire par Ministère Référent</h4>
                    <p className="text-xs text-slate-400">Comparaison entre Crédits Votés et Crédits Exécutés (Milliards FCFA)</p>
                  </div>
                  <span className="text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-slate-400 font-mono">T2 2024</span>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={MINISTRY_EXECUTION_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="vote" name="Crédits Votés" fill="#334155" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="execute" name="Crédits Exécutés" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Historical Multi-Year Trends */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-bold text-slate-200">Évolution Pluriannuelle</h4>
                      <p className="text-xs text-slate-400">Trajectoire des lois de finances (2022 - 2025)</p>
                    </div>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={HISTORICAL_TRENDS} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                        <Line type="monotone" dataKey="prevision" name="Prévisions" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="execution" name="Réalisations" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-400 flex items-start space-x-2 mt-2">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>La pente observée reflète la trajectoire de cadrage macroéconomique et de gestion axée sur les résultats (GAR).</span>
                </div>
              </div>

            </div>

            {/* QUICK ALERTS PREVIEW */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h4 className="font-bold text-slate-200">Dernières Alertes Générées par l'IA (Validation Humaine Requise)</h4>
                </div>
                <button 
                  onClick={() => setActiveTab('alerts')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                >
                  <span>Voir toutes les alertes ({alerts.length})</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {alerts.slice(0, 2).map((alert) => (
                  <div key={alert.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex items-center space-x-2">
                        <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-2 py-0.5 rounded font-mono font-semibold">
                          {alert.type}
                        </span>
                        <span className="text-xs text-slate-400">{alert.document} — <strong className="text-slate-300">{alert.section}</strong></span>
                      </div>
                      <p className="text-sm text-slate-200 font-medium">{alert.description}</p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {alert.status === 'En attente' ? (
                        <>
                          <button
                            onClick={() => handleVerifyAlert(alert.id, 'Vérifié')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Valider</span>
                          </button>
                          <button
                            onClick={() => handleVerifyAlert(alert.id, 'Rejeté')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejeter</span>
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                          alert.status === 'Vérifié' 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}>
                          {alert.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* --- TAB 2: AGENT IA CHAT & BRIEFING --- */}
        {activeTab === 'agent' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[720px]">
            
            {/* Left Column: Context & Prompts */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">Agent IA d'Analyse Budgétaire</h3>
                    <p className="text-xs text-slate-400">Assistante documentaire & RAG souverain</p>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-300 space-y-2 mb-6">
                  <p className="font-semibold text-emerald-400">Périmètre d'action de l'Agent :</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Parsing & Extraction RAG des textes et tableaux PDF.</li>
                    <li>Rapprochement entre Lois de Finances & Rapports d'Exécution.</li>
                    <li>Génération de fiches de briefing pour la Commission des Finances.</li>
                  </ul>
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recommandations de Requêtes :</h4>
                <div className="space-y-2">
                  {[
                    "Analyser l'exécution du ministère de la Santé",
                    "Détecter les écarts dans le rapport T2 2024",
                    "Générer une note de briefing pour la Commission des Finances",
                    "Comparer l'évolution du BIP entre 2023 et 2024"
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendPrompt(prompt)}
                      className="w-full text-left text-xs bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 p-3 rounded-xl text-slate-300 hover:text-emerald-300 transition-all flex items-center justify-between group"
                    >
                      <span>"{prompt}"</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-500 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Traçabilité complète des sources & contrôle humain obligatoire.</span>
              </div>
            </div>

            {/* Right Column: Chat Conversation */}
            <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden">
              
              {/* Chat Messages Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-semibold text-slate-300">Session d'interrogation dynamique</span>
                </div>
                <span className="text-xs font-mono text-slate-500">Corpus: 2024 (Loi & Rapports MINFI)</span>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-2xl rounded-2xl p-4 text-sm ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none space-y-3'
                    }`}>
                      {/* Message Text with simple formatting */}
                      <div className="whitespace-pre-line leading-relaxed">
                        {msg.text}
                      </div>

                      {/* Source Citations for AI Responses */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/80 mt-2 space-y-1">
                          <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                            <Search className="w-3 h-3" /> Source(s) Documentaire(s) Vérifiée(s) :
                          </p>
                          {msg.sources.map((src, idx) => (
                            <div key={idx} className="text-xs bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800 text-slate-400 flex justify-between font-mono">
                              <span>{src.doc}</span>
                              <span className="text-slate-300">{src.page}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isAnalysing && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-400 text-xs flex items-center space-x-3">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Extraction RAG en cours & analyse de cohérence dans le corpus budgétaire...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/40">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendPrompt();
                  }}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Posez une question sur le budget (ex: Taux d'exécution du MINT) ou demandez une synthèse..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isAnalysing || !inputQuery.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-4 py-3 rounded-xl transition-colors flex items-center justify-center shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>

          </div>
        )}

        {/* --- TAB 3: ALERTS & ANOMALIES FEED --- */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Registre des Alertes & Incohérences Budgétaires</h3>
                <p className="text-xs text-slate-400">Système automatisé de détection avec étape de validation humaine préalable</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Statut :</span>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-lg text-xs font-semibold">
                  {alerts.filter(a => a.status === 'En attente').length} En attente de validation
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-900 text-slate-300 border border-slate-800 text-xs font-mono px-2.5 py-1 rounded-md">
                          {alert.id}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                          alert.severity === 'Haute' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          Priorité {alert.severity}
                        </span>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-md font-medium">
                          {alert.type}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-100">{alert.description}</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-900">
                        <div>
                          <span className="text-slate-500">Document d'origine:</span> <strong className="text-slate-300">{alert.document}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Localisation:</span> <strong className="text-slate-300">{alert.section}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Ministère concerné:</span> <strong className="text-slate-300">{alert.ministry}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Détecté le:</span> <strong className="text-slate-300">{alert.detectedAt}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Panel for Human Validation */}
                    <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between shrink-0 min-w-[220px]">
                      <span className="text-xs text-slate-400 mb-2 font-medium">Validation par Administrateur :</span>
                      
                      {alert.status === 'En attente' ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleVerifyAlert(alert.id, 'Vérifié')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirmer & Transmettre</span>
                          </button>
                          <button
                            onClick={() => handleVerifyAlert(alert.id, 'Rejeté')}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Rejeter Faux Positif</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <span className={`inline-flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                            alert.status === 'Vérifié'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {alert.status === 'Vérifié' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>Statut: {alert.status}</span>
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB 4: DOCUMENT MANAGEMENT & PROCESSING HUB --- */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Hub de Traitement Documentaire</h3>
                <p className="text-xs text-slate-400">Ingestion des rapports de finances publiques, numérisation OCR & extraction structurée</p>
              </div>
            </div>

            {/* Upload Simulator */}
            <div className="bg-slate-950 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-8 text-center transition-colors">
              <Upload className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h4 className="font-bold text-slate-200 text-sm">Déposer un document budgétaire (PDF, Excel, Scan)</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                L'Agent IA appliquera la numérisation OCR, l'extraction des nomenclatures comptables et le contrôle de cohérence arithmétique.
              </p>
              <button className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                Simuler l'ingestion d'un fichier
              </button>
            </div>

            {/* Processed Documents List */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
              <h4 className="font-bold text-slate-200 text-sm mb-4">Corpus Documentaire Traité & Indexé</h4>
              <div className="space-y-3">
                {[
                  { title: "Rapport d'exécution du budget de l'État (MINFI) - Fin Juin 2024", pages: 119, status: "Indexé & Analyse RAG", date: "2024-10-24" },
                  { title: "Loi de Finances de la République - Exercice 2024", pages: 240, status: "Indexé & Analyse RAG", date: "2024-01-10" },
                  { title: "Rapport Annuel de la Chambre des Comptes 2023", pages: 185, status: "Indexé & Analyse RAG", date: "2024-03-15" }
                ].map((doc, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-slate-800 rounded-lg text-emerald-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-slate-200">{doc.title}</h5>
                        <p className="text-xs text-slate-500">{doc.pages} pages • Importé le {doc.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-md font-medium">
                        {doc.status}
                      </span>
                      <button className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 5: GOVERNANCE & AUDIT LOGS --- */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white">Journal d'Audit & Chaîne de Traçabilité</h3>
              <p className="text-xs text-slate-400">Suivi inaltérable des traitements algorithmiques et des interventions humaines</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Horodatage</th>
                      <th className="p-4">Acteur / Rôle</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Détails du Traitement</th>
                      <th className="p-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-4 font-mono text-slate-400">{log.timestamp}</td>
                        <td className="p-4 font-semibold text-emerald-400">{log.user}</td>
                        <td className="p-4">{log.action}</td>
                        <td className="p-4 text-slate-400">{log.detail}</td>
                        <td className="p-4">
                          <span className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© 2026 Assemblée Nationale — Système d'Analyse Budgétaire Assisté par IA</p>
          <div className="flex items-center space-x-4">
            <span>Conforme aux règles éthiques UNESCO & Règlement Intérieur</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">Supervision Humaine Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
