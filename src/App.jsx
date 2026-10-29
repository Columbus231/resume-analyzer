import { useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Award, BarChart3, BookOpen, BriefcaseBusiness,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, FileCheck2, FileText,
  Gauge, GraduationCap, LayoutDashboard, Lightbulb, LoaderCircle, LockKeyhole, Menu,
  MessageSquareText, MoreHorizontal, Plus, Rocket, Search, ShieldCheck, Sparkles, Target,
  Trash2, Upload, WandSparkles, X, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const navigation = [
  { id: "Dashboard", icon: LayoutDashboard },
  { id: "Analyze Resume", icon: FileText },
  { id: "Skills Analysis", icon: BarChart3 },
  { id: "Job Recommendations", icon: BriefcaseBusiness },
  { id: "Learning Roadmap", icon: BookOpen },
  { id: "Profile", icon: GraduationCap },
];
const colors = ["#7565e8", "#93a4ff", "#53bd9b", "#ffb85c", "#e78aaa", "#78bfd2"];
const errorMessage = (error) => error.response?.data?.detail || error.message || "Something went wrong. Please try again.";

function App() {
  const [page, setPage] = useState("Dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [targetRole, setTargetRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [improved, setImproved] = useState(null);
  const [improving, setImproving] = useState(false);
  const fileInput = useRef(null);

  const go = (next) => {
    setPage(next);
    setMobileMenu(false);
    setError("");
  };
  const handleUpload = async (file) => {
    if (!file) return;
    setError("");
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Choose a PDF or DOCX file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("The file must be 5 MB or less.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await axios.post(`${API}/api/resume/upload`, body);
      setResumeText(response.data.text);
      setFileName(response.data.filename);
      setNotice("Resume text extracted. Review it before analysis.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setUploading(false);
    }
  };
  const runAnalysis = async (role = targetRole) => {
    setError("");
    setNotice("");
    if (resumeText.trim().length < 30) {
      setError("Add at least 30 characters of resume text before analyzing.");
      go("Analyze Resume");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/resume/analyze`, {
        resume_text: resumeText,
        target_role: role || null,
      });
      setAnalysis(response.data);
      setTargetRole(response.data.selected_role || role);
      setHistory((previous) => [
        { created: new Date(), score: response.data.resume_score.overall, role: response.data.selected_role },
        ...previous,
      ].slice(0, 5));
      setImproved(null);
      setNotice("Your resume analysis is ready.");
      setPage("Dashboard");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  const selectRole = (role) => {
    setTargetRole(role);
    if (resumeText) runAnalysis(role);
  };
  const improve = async (item, currentText) => {
    if (!resumeText || !item || !currentText?.trim()) {
      setError("Add the resume text for this section before generating a preview.");
      return;
    }
    setError("");
    setImproving(true);
    try {
      const response = await axios.post(`${API}/api/resume/improve`, {
        resume_text: resumeText,
        section: item.section,
        current_text: currentText,
      });
      setImproved(response.data);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setImproving(false);
    }
  };
  const downloadReport = async () => {
    if (!analysis) return;
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    let y = 18;
    const line = (text, size = 10, gap = 6) => {
      pdf.setFontSize(size);
      const wrapped = pdf.splitTextToSize(String(text), 175);
      if (y + wrapped.length * gap > 280) { pdf.addPage(); y = 18; }
      pdf.text(wrapped, 17, y);
      y += wrapped.length * gap + 3;
    };
    line("CareerLens AI · Resume analysis", 18, 8);
    line(`Guidance score: ${analysis.resume_score.overall}/100${analysis.demo_mode ? " · Demo mode" : ""}`, 12);
    line("Summary", 14, 7);
    line(analysis.resume_summary);
    line("Recommended roles", 14, 7);
    analysis.job_recommendations.forEach((role) => line(`${role.role} — ${role.match_percentage}% (estimate)`));
    line("Skill gaps", 14, 7);
    analysis.missing_skills.forEach((gap) => line(`${gap.skill} · ${gap.priority}: ${gap.reason}`));
    line("Improvement suggestions", 14, 7);
    analysis.resume_improvements.forEach((item) => line(`${item.section}: ${item.suggestion}`));
    line("Scores are guidance only; they are not an ATS score or an employment prediction.", 9);
    pdf.save("careerlens-analysis.pdf");
  };
  const downloadResume = async () => {
    if (!improved?.suggested) return;
    try {
      if (!improved.original || !resumeText.includes(improved.original)) {
        setError("The resume text no longer matches this preview. Analyze the current text again before exporting.");
        return;
      }
      const improvedResume = resumeText.replace(improved.original, improved.suggested);
      const response = await axios.post(`${API}/api/resume/export`, {
        resume_text: improvedResume,
      }, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "careerlens-resume-draft.docx";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };
  const clearData = () => {
    setResumeText("");
    setFileName("");
    setAnalysis(null);
    setHistory([]);
    setImproved(null);
    setNotice("Your resume text and this session's analysis history were cleared.");
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      {mobileMenu && <button aria-label="Close navigation" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#eceef4] bg-white px-5 transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[83px] items-center justify-between">
          <button className="flex items-center gap-3 text-left" onClick={() => go("Dashboard")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-brand-500 to-[#a98af6] text-white shadow-md shadow-brand-500/20"><Sparkles size={20} /></span>
            <span><span className="heading-font block text-[17px] font-extrabold tracking-[-.6px] text-ink">CareerLens<span className="text-brand-600"> AI</span></span><span className="block text-[10px] font-semibold tracking-[1.4px] text-slate-400">CAREER COMPANION</span></span>
          </button>
          <button className="lg:hidden" aria-label="Close menu" onClick={() => setMobileMenu(false)}><X size={19} /></button>
        </div>
        <div className="mb-3 mt-6 px-3 text-[10px] font-bold uppercase tracking-[1.5px] text-slate-400">Workspace</div>
        <nav className="space-y-1">
          {navigation.map(({ id, icon: Icon }) => (
            <button key={id} onClick={() => go(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-[11px] text-left text-[13px] font-semibold transition ${page === id ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50 hover:text-ink"}`}>
              <Icon size={17} strokeWidth={page === id ? 2.3 : 1.8} /><span className="flex-1">{id}</span>
              {id === "Analyze Resume" && !analysis && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
            </button>
          ))}
        </nav>
        <div className="mt-auto mb-5 rounded-2xl bg-gradient-to-br from-[#f2f0ff] to-[#f7f4ff] p-4">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm"><Zap size={17} /></span>
          <p className="heading-font text-[13px] font-bold text-ink">Your next step starts here</p>
          <p className="mt-1 text-[11px] leading-[1.6] text-slate-500">Small improvements today can make your resume easier to understand.</p>
          <button onClick={() => go("Analyze Resume")} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-brand-700">Analyze my resume <ArrowRight size={13} /></button>
        </div>
        <div className="flex items-center gap-3 border-t border-slate-100 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2eeff] text-brand-700"><GraduationCap size={17} /></div>
          <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-ink">Student workspace</div><div className="text-[10px] text-slate-400">Private session</div></div>
          <button onClick={() => go("Profile")} aria-label="Profile settings"><MoreHorizontal size={18} className="text-slate-400" /></button>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#eceef4] bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19} /></button>
            <div className="hidden text-[12px] text-slate-400 sm:block">Workspace <ChevronRight className="mx-1 inline" size={13} /> <span className="font-semibold text-ink">{page}</span></div>
            <div className="text-[13px] font-bold text-ink sm:hidden">{page}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Private workspace</span>
            <button onClick={downloadReport} disabled={!analysis} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 shadow-sm transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-40"><ArrowDownToLine size={14} /><span className="hidden sm:inline">Export report</span></button>
            <button onClick={() => go("Profile")} className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-[#e9e4ff] text-[11px] font-bold text-brand-700">S</button>
          </div>
        </header>
        <section className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          {error && <Notice kind="error" onClose={() => setError("")}>{error}</Notice>}
          {notice && <Notice kind="success" onClose={() => setNotice("")}>{notice}</Notice>}
          {page === "Dashboard" && <Dashboard analysis={analysis} history={history} loading={loading} onAnalyze={() => go("Analyze Resume")} onRole={selectRole} />}
          {page === "Analyze Resume" && <AnalyzePage text={resumeText} setText={setResumeText} fileName={fileName} onUpload={handleUpload} fileInput={fileInput} uploading={uploading} loading={loading} onAnalyze={() => runAnalysis()} />}
          {page === "Skills Analysis" && <SkillsPage analysis={analysis} onAnalyze={() => go("Analyze Resume")} />}
          {page === "Job Recommendations" && <JobsPage analysis={analysis} targetRole={targetRole} onRole={selectRole} onAnalyze={() => go("Analyze Resume")} />}
          {page === "Learning Roadmap" && <RoadmapPage analysis={analysis} onAnalyze={() => go("Analyze Resume")} />}
          {page === "Profile" && <ProfilePage onClear={clearData} historyCount={history.length} />}
          {analysis && page === "Dashboard" && <AnalysisDetails analysis={analysis} resumeText={resumeText} onImprove={improve} improving={improving} improved={improved} onDownloadResume={downloadResume} />}
        </section>
        <footer className="mx-auto flex max-w-[1440px] flex-col justify-between gap-2 px-5 pb-7 text-[10px] text-slate-400 sm:flex-row sm:px-8 lg:px-10">
          <span>CareerLens AI · A student career guidance tool</span>
          <span>Scores and role matches are estimates, not guarantees of employability.</span>
        </footer>
      </main>
    </div>
  );
}

function Notice({ children, kind, onClose }) {
  const isError = kind === "error";
  return <div role={isError ? "alert" : "status"} className={`mb-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[12px] ${isError ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
    <span>{children}</span><button aria-label="Dismiss notification" onClick={onClose}><X size={15} /></button>
  </div>;
}

function PageTitle({ eyebrow, title, description, action }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><div className="mb-2 text-[10px] font-bold uppercase tracking-[1.8px] text-brand-600">{eyebrow}</div><h1 className="heading-font text-[25px] font-extrabold tracking-[-1px] text-ink sm:text-[30px]">{title}</h1><p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-slate-500">{description}</p></div>
    {action}
  </div>;
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-[#eceef4] bg-white shadow-card ${className}`}>{children}</div>;
}

function Dashboard({ analysis, history, loading, onAnalyze, onRole }) {
  const score = analysis?.resume_score.overall;
  return <div className="fade-in">
    <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-center">
      <div><div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700"><Sparkles size={12} /> YOUR CAREER COMPANION</div><h1 className="heading-font text-[27px] font-extrabold tracking-[-1px] text-ink sm:text-[32px]">Build your next big thing.</h1><p className="mt-1.5 text-[12px] text-slate-500">{analysis ? "Here’s a fresh look at your resume and the next steps you can take." : "A clearer resume. A more confident next step. Let’s get started."}</p></div>
      <button onClick={onAnalyze} className="flex w-fit items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-[12px] font-bold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700"><Plus size={16} /> Analyze a resume <ArrowRight size={14} /></button>
    </div>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="overflow-hidden p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">Resume guidance score</span><Gauge size={16} className="text-brand-500" /></div><div className="mt-3 flex items-end gap-2"><strong className="heading-font text-[29px] font-extrabold text-ink">{score ?? "—"}</strong><span className="pb-1 text-[11px] text-slate-400">{score !== undefined ? "/ 100" : "Not analyzed"}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${score ?? 0}%` }} /></div><div className="mt-2 text-[10px] text-slate-400">Internal guidance · not an ATS score</div></Card>
      <Card className="p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">Skills identified</span><Target size={16} className="text-[#39a787]" /></div><div className="mt-3 flex items-end gap-2"><strong className="heading-font text-[29px] font-extrabold text-ink">{analysis?.skills.length ?? "—"}</strong><span className="pb-1 text-[11px] text-slate-400">{analysis ? "resume signals" : "Awaiting analysis"}</span></div><p className="mt-3 text-[10px] text-slate-400">Mentioned skills are not independently verified.</p></Card>
      <Card className="p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">Role directions</span><BriefcaseBusiness size={16} className="text-[#e7a74f]" /></div><div className="mt-3 flex items-end gap-2"><strong className="heading-font text-[29px] font-extrabold text-ink">{analysis?.job_recommendations.length ?? "—"}</strong><span className="pb-1 text-[11px] text-slate-400">{analysis ? "suggested paths" : "Explore your fit"}</span></div><p className="mt-3 text-[10px] text-slate-400">Estimated matches based on resume evidence.</p></Card>
      <Card className="p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">Learning roadmap</span><BookOpen size={16} className="text-[#d779a0]" /></div><div className="mt-3 flex items-end gap-2"><strong className="heading-font text-[29px] font-extrabold text-ink">{analysis?.learning_suggestions.length ?? "—"}</strong><span className="pb-1 text-[11px] text-slate-400">{analysis ? "skills to explore" : "Build your plan"}</span></div><p className="mt-3 text-[10px] text-slate-400">Practical ideas to help you keep learning.</p></Card>
    </div>
    {!analysis ? <WelcomePanel onAnalyze={onAnalyze} loading={loading} /> : <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <Card className="p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="heading-font text-[16px] font-bold text-ink">Your career snapshot</h2><p className="mt-1 text-[10px] text-slate-400">A quick view of your current resume analysis</p></div><button onClick={onAnalyze} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50" aria-label="Analyze another resume"><MoreHorizontal size={18} /></button></div><div className="flex flex-col items-center gap-7 sm:flex-row"><div className="relative flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-full p-[12px]" style={{ background: `conic-gradient(#7565e8 ${score * 3.6}deg, #f0eff6 0deg)` }}><div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white"><span className="heading-font text-[34px] font-extrabold text-ink">{score}</span><span className="text-[9px] font-bold uppercase tracking-[1px] text-slate-400">Guidance score</span></div><span className="absolute -right-1 top-4 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-[#ebe8ff] text-brand-600"><Sparkles size={13} /></span></div><div className="w-full flex-1"><p className="text-[11px] leading-[1.8] text-slate-500">{analysis.resume_summary}</p><div className="mt-4 grid grid-cols-2 gap-3">{Object.entries(analysis.resume_score.dimensions).slice(0, 4).map(([label, value]) => <div key={label}><div className="mb-1.5 flex justify-between text-[9px] font-semibold text-slate-500"><span>{humanize(label)}</span><span>{value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-400" style={{ width: `${value}%` }} /></div></div>)}</div></div></div><div className="mt-5 border-t border-slate-100 pt-4 text-[10px] leading-5 text-slate-400">{analysis.resume_score.explanation[0]}</div></Card>
      <Card className="p-5 sm:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="heading-font text-[16px] font-bold text-ink">Top role matches</h2><p className="mt-1 text-[10px] text-slate-400">Estimates based on resume skill overlap</p></div><BriefcaseBusiness size={17} className="text-brand-500" /></div><div className="space-y-3">{analysis.job_recommendations.slice(0, 4).map((role, index) => <button key={role.role} onClick={() => onRole(role.role)} className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-brand-100 hover:bg-brand-50/40"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${index === 0 ? "bg-brand-50 text-brand-700" : "bg-slate-50 text-slate-500"}`}>0{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-ink">{role.role}</span><span className="mt-1 block text-[9px] text-slate-400">{role.matching_skills.length} mapped skills found</span></span><span className="text-[12px] font-bold text-brand-700">{role.match_percentage}%</span><ChevronRight size={14} className="text-slate-300 transition group-hover:text-brand-500" /></button>)}</div><div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[9px] leading-4 text-amber-800"><CircleHelp size={13} className="mt-0.5 shrink-0" /> Match percentages are configurable estimates, not guarantees of employability.</div></Card>
    </div>}
    {analysis && <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="heading-font text-[15px] font-bold text-ink">Skills to explore</h2><p className="mt-1 text-[10px] text-slate-400">For your selected career direction</p></div><button onClick={() => onRole(analysis.selected_role)} className="text-[10px] font-bold text-brand-700">Refresh <ArrowUpRight size={12} className="inline" /></button></div><div className="flex flex-wrap gap-2">{analysis.missing_skills.slice(0, 6).map((gap) => <span key={gap.skill} className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800">{gap.skill}<span className="ml-1.5 text-[8px] uppercase opacity-70">{gap.priority}</span></span>)}{analysis.missing_skills.length === 0 && <p className="text-[11px] text-slate-500">No gaps were identified for this direction.</p>}</div><p className="mt-4 text-[9px] text-slate-400">Not mentioned does not mean you do not know a skill.</p></Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="heading-font text-[15px] font-bold text-ink">Recent analyses</h2><p className="mt-1 text-[10px] text-slate-400">Stored only for this browser session</p></div><Clock3 size={16} className="text-slate-400" /></div>{history.length ? <div className="space-y-2">{history.slice(0, 3).map((item, index) => <div key={`${item.created}-${index}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"><FileCheck2 size={15} className="text-brand-500" /><span className="flex-1 text-[10px] font-semibold text-slate-600">{item.role || "Resume analysis"}</span><span className="text-[10px] font-bold text-ink">{item.score}/100</span><span className="text-[9px] text-slate-400">{item.created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>)}</div> : <p className="rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">Your session's previous analyses will show here.</p>}</Card>
    </div>}
  </div>;
}

function WelcomePanel({ onAnalyze, loading }) {
  return <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5345bd] via-[#7162d6] to-[#8979e7] p-7 text-white shadow-float sm:p-9"><div className="absolute -right-8 -top-10 h-48 w-48 rounded-full border-[28px] border-white/5" /><div className="absolute -bottom-20 right-28 h-48 w-48 rounded-full border-[24px] border-white/5" /><div className="relative z-10 max-w-xl"><span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-semibold tracking-wide"><Sparkles size={12} /> YOUR PERSONAL CAREER LENS</span><h2 className="heading-font mt-5 text-[25px] font-extrabold leading-tight tracking-[-.8px] sm:text-[32px]">Build a Stronger Resume.<br />Prepare for Your Dream Career.</h2><p className="mt-3 max-w-md text-[11px] leading-[1.8] text-white/75">Understand the skills you already show, explore career paths, and get practical ideas to keep growing.</p><button disabled={loading} onClick={onAnalyze} className="mt-6 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[11px] font-bold text-brand-700 shadow-lg transition hover:bg-brand-50 disabled:opacity-70">{loading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />} {loading ? "Analyzing..." : "Get started"} <ArrowRight size={14} /></button><div className="mt-4 flex items-center gap-2 text-[9px] text-white/65"><LockKeyhole size={12} /> Your resume is not saved by this app.</div></div></div>
    <Card className="p-6 sm:p-7"><div className="mb-5 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0efff] text-brand-600"><Rocket size={16} /></span><div><h3 className="heading-font text-[14px] font-bold text-ink">A simple way forward</h3><p className="text-[10px] text-slate-400">Three steps to get started</p></div></div><div className="space-y-4">{[["01", "Share your resume", "Upload a PDF or DOCX, or paste your text."], ["02", "Review your analysis", "See skills, estimated role matches, and suggestions."], ["03", "Make a small next move", "Choose a skill to practice and build evidence."]].map(([num, title, detail]) => <div key={num} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[9px] font-bold text-brand-700">{num}</span><div><div className="text-[11px] font-bold text-ink">{title}</div><div className="mt-1 text-[10px] leading-4 text-slate-400">{detail}</div></div></div>)}</div><div className="mt-5 rounded-xl border border-slate-100 bg-[#fbfbfd] p-3"><div className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" /><p className="text-[9px] leading-4 text-slate-500">Demo mode is available without an AI key. AI processing is optional and uses the provider configured by your placement cell.</p></div></div></Card>
  </div>;
}

function AnalyzePage({ text, setText, fileName, onUpload, fileInput, uploading, loading, onAnalyze }) {
  const [dragging, setDragging] = useState(false);
  return <div className="fade-in"><PageTitle eyebrow="Resume workspace" title="Analyze your resume" description="Upload a file or paste your resume text. Check the extracted content and edit it before sending it for analysis." />
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Upload size={16} /></span><div><h2 className="text-[13px] font-bold text-ink">Upload a resume</h2><p className="text-[10px] text-slate-400">PDF or DOCX · 5 MB maximum</p></div></div>
        <button onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onUpload(event.dataTransfer.files[0]); }} className={`flex min-h-[178px] w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition ${dragging ? "border-brand-500 bg-brand-50" : "border-[#dfe2eb] bg-[#fbfbfd] hover:border-brand-300 hover:bg-brand-50/30"}`}><span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm"><Upload size={19} /></span><span className="text-[11px] font-bold text-ink">{uploading ? "Extracting resume text…" : fileName || "Drop your resume here"}</span><span className="mt-1 text-[9px] text-slate-400">{uploading ? "This can take a moment" : "or click to browse your files"}</span><input ref={fileInput} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} /></button>
        <div className="my-4 flex items-center gap-3"><div className="h-px flex-1 bg-slate-100" /><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">OR</span><div className="h-px flex-1 bg-slate-100" /></div><div className="rounded-xl border border-slate-100 bg-[#fbfbfd] p-4"><div className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /><p className="text-[9px] leading-4 text-slate-500">Files are processed in memory and discarded after extraction. We do not save your uploaded file.</p></div></div>
      </Card>
      <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[13px] font-bold text-ink">Resume text</h2><p className="mt-1 text-[10px] text-slate-400">Review and make changes before analysis</p></div><span className="text-[9px] text-slate-400">{text.length.toLocaleString()} / 30,000</span></div><textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 30000))} maxLength={30000} placeholder={"Paste your resume content here…\n\nInclude education, skills, projects, and experience if available."} className="min-h-[255px] w-full resize-y rounded-xl border border-slate-200 bg-[#fbfbfd] p-4 text-[11px] leading-[1.8] text-slate-700 placeholder:text-slate-300 focus:border-brand-300 focus:bg-white focus:outline-none" /><div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><span className="text-[9px] text-slate-400">At least 30 characters · avoid including details you don’t want processed</span><button disabled={loading} onClick={onAnalyze} className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-[11px] font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><LoaderCircle size={14} className="animate-spin" /> Analyzing…</> : <><Sparkles size={14} /> Analyze resume</>}</button></div></Card>
    </div>
    <Card className="mt-5 flex items-start gap-3 bg-[#fbfbfd] p-4"><CircleHelp size={16} className="mt-0.5 text-brand-500" /><div><div className="text-[10px] font-bold text-ink">Your resume is your data</div><p className="mt-1 text-[9px] leading-4 text-slate-500">When AI is enabled, text is sent to the configured AI provider for analysis. Use demo mode to keep analysis local to this backend. The application does not store your resume or analysis history on its server.</p></div></Card>
  </div>;
}

function SkillsPage({ analysis, onAnalyze }) {
  const data = useMemo(() => {
    const counts = {};
    analysis?.skills.forEach((skill) => { counts[skill.category] = (counts[skill.category] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analysis]);
  if (!analysis) return <EmptyState title="Your skills map is waiting" message="Analyze your resume to see the skills and evidence identified in your text." onAnalyze={onAnalyze} />;
  const groups = analysis.skills.reduce((all, skill) => ({ ...all, [skill.category]: [...(all[skill.category] || []), skill] }), {});
  return <div className="fade-in"><PageTitle eyebrow="Skills analysis" title="A clearer view of your skills" description="Skills are drawn from your resume text. Mentions are not a verification of proficiency or experience." />
    <div className="mb-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <Card className="p-5"><h2 className="heading-font text-[14px] font-bold text-ink">Skill categories</h2><p className="mt-1 text-[10px] text-slate-400">Count of resume signals by category</p><div className="mt-3 h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 8, right: 12, top: 5, bottom: 5 }}><CartesianGrid stroke="#f0f1f5" horizontal={false} /><XAxis type="number" hide allowDecimals={false} /><YAxis dataKey="name" type="category" width={125} tick={{ fontSize: 9, fill: "#77829a" }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f8f7ff" }} /><Bar dataKey="value" fill="#7565e8" radius={[0, 5, 5, 0]} barSize={13} /></BarChart></ResponsiveContainer></div></Card>
      <Card className="p-5"><h2 className="heading-font text-[14px] font-bold text-ink">Evidence breakdown</h2><p className="mt-1 text-[10px] text-slate-400">Explicit mentions and AI-inferred signals</p><div className="flex flex-col items-center gap-4 sm:flex-row"><div className="h-[210px] w-full max-w-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: "Mentioned", value: analysis.skills.filter((s) => s.evidence === "Mentioned").length }, { name: "Inferred", value: analysis.skills.filter((s) => s.evidence === "Inferred").length }]} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={4}><Cell fill="#7565e8" /><Cell fill="#ffb85c" /></Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-3 text-[10px]"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-500" /> Mentioned directly in text <b>{analysis.skills.filter((s) => s.evidence === "Mentioned").length}</b></div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ffb85c]" /> Inferred by AI <b>{analysis.skills.filter((s) => s.evidence === "Inferred").length}</b></div><p className="max-w-[200px] leading-4 text-slate-400">An inferred skill should be checked. Any skill may still be known even when it is absent from the resume.</p></div></div></Card>
    </div>
    <div className="grid gap-4 md:grid-cols-2">{Object.entries(groups).map(([category, skills]) => <Card key={category} className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-[12px] font-bold text-ink">{category}</h3><span className="rounded-full bg-slate-50 px-2 py-1 text-[9px] text-slate-500">{skills.length} {skills.length === 1 ? "skill" : "skills"}</span></div><div className="space-y-2">{skills.map((skill) => <div key={`${skill.name}-${skill.category}`} className="flex items-start gap-3 rounded-lg bg-[#fbfbfd] px-3 py-2.5"><span className={`mt-0.5 rounded px-1.5 py-1 text-[8px] font-bold ${skill.evidence === "Mentioned" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{skill.evidence}</span><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold text-slate-700">{skill.name}</div>{skill.excerpt && <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-400">“{skill.excerpt}”</div>}</div><span className="text-[8px] text-slate-400">{skill.confidence}%</span></div>)}</div></Card>)}</div>
  </div>;
}

function JobsPage({ analysis, targetRole, onRole, onAnalyze }) {
  if (!analysis) return <EmptyState title="Explore your career directions" message="Analyze your resume to see suitable entry-level career paths and the evidence behind each estimate." onAnalyze={onAnalyze} />;
  return <div className="fade-in"><PageTitle eyebrow="Role explorer" title="Career directions to explore" description="These estimated matches use skill overlap and project evidence. They are not live vacancies or predictions of employability." />
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 p-4"><Target size={16} className="text-brand-600" /><label htmlFor="target-role" className="text-[10px] font-bold text-ink">Focus your skill gap:</label><select id="target-role" value={targetRole} onChange={(event) => onRole(event.target.value)} className="ml-auto min-w-[190px] rounded-lg border border-brand-100 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700"><option value="">Top estimated match</option>{analysis.job_recommendations.map((role) => <option key={role.role} value={role.role}>{role.role}</option>)}</select></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{analysis.job_recommendations.map((role, index) => <Card key={role.role} className="flex flex-col p-5"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{index === 0 ? <Award size={18} /> : <BriefcaseBusiness size={18} />}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">{role.match_percentage}% estimate</span></div><h2 className="heading-font mt-4 text-[15px] font-bold text-ink">{role.role}</h2><p className="mt-2 min-h-[48px] text-[10px] leading-[1.7] text-slate-500">{role.reason}</p><div className="mt-3"><div className="mb-1.5 text-[9px] font-bold text-slate-500">Skills found in resume</div><div className="flex flex-wrap gap-1.5">{role.matching_skills.length ? role.matching_skills.map((skill) => <span key={skill} className="rounded-md bg-emerald-50 px-2 py-1 text-[8px] text-emerald-700">{skill}</span>) : <span className="text-[9px] text-slate-400">No mapped skills found</span>}</div></div><div className="mt-3"><div className="mb-1.5 text-[9px] font-bold text-slate-500">Skills to explore</div><div className="flex flex-wrap gap-1.5">{role.missing_skills.slice(0, 4).map((skill) => <span key={skill} className="rounded-md bg-amber-50 px-2 py-1 text-[8px] text-amber-700">{skill}</span>)}</div></div><button onClick={() => onRole(role.role)} className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-left text-[10px] font-bold text-brand-700">Focus skill gap on this role <ArrowRight size={14} /></button></Card>)}</div>
  </div>;
}

function RoadmapPage({ analysis, onAnalyze }) {
  const [complete, setComplete] = useState({});
  if (!analysis) return <EmptyState title="Turn a skill gap into a plan" message="Analyze your resume to create a practical, role-focused learning roadmap." onAnalyze={onAnalyze} />;
  const suggestions = analysis.learning_suggestions;
  const weeks = [suggestions.slice(0, 1), suggestions.slice(1, 2), suggestions.slice(2, 4), suggestions.slice(4)];
  const goals = ["Build your foundations", "Practice with guided exercises", "Apply your skills in a project", "Polish and share your work"];
  const downloadRoadmap = () => {
    const lines = [
      `CareerLens AI — 30-day roadmap for ${analysis.selected_role || "your career direction"}`,
      "A flexible starter plan. Adjust the pace to fit your schedule.",
      "",
      ...weeks.flatMap((items, week) => [
        `Week ${week + 1}: ${goals[week]}`,
        ...(items.length ? items.map((item) => `- ${item.skill}: ${item.why_useful}\n  Practice: ${item.practice_project}\n  Resources: ${item.resources.map((resource) => `${resource.title} (${resource.url})`).join(", ")}`) : ["- Review your learning and document your progress."]),
        "",
      ]),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "careerlens-30-day-roadmap.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="fade-in"><PageTitle eyebrow="Your 30-day plan" title="Make learning feel doable" description={`A starter roadmap for ${analysis.selected_role || "your career direction"}. Adjust the pace to fit your schedule; this is a suggested plan, not a deadline.`} action={<button onClick={downloadRoadmap} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 shadow-sm hover:border-brand-200 hover:text-brand-700"><ArrowDownToLine size={14} /> Download roadmap</button>} />
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white p-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm"><Rocket size={17} /></span><div className="flex-1"><div className="text-[11px] font-bold text-ink">30-day learning roadmap</div><div className="mt-1 text-[9px] text-slate-500">Four flexible weekly milestones · {suggestions.length} skill suggestions</div></div><span className="text-[11px] font-bold text-brand-700">{Object.values(complete).filter(Boolean).length}/{suggestions.length} done</span></div>
    <div className="relative grid gap-4 lg:grid-cols-2">{weeks.map((items, week) => <Card key={week} className="p-5"><div className="mb-4 flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-bold ${week === 0 ? "bg-brand-50 text-brand-700" : "bg-slate-50 text-slate-500"}`}>W{week + 1}</span><div><div className="text-[12px] font-bold text-ink">Week {week + 1}</div><div className="text-[9px] text-slate-400">{goals[week]}</div></div></div>{items.length ? <div className="space-y-3">{items.map((item, index) => { const key = `${week}-${index}`; return <div key={key} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start gap-2"><button aria-label={`Mark ${item.skill} complete`} onClick={() => setComplete({ ...complete, [key]: !complete[key] })} className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${complete[key] ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check size={10} /></button><div className="flex-1"><div className={`text-[10px] font-bold ${complete[key] ? "text-slate-400 line-through" : "text-ink"}`}>{item.skill}</div><p className="mt-1 text-[9px] leading-4 text-slate-500">{item.why_useful}</p><div className="mt-2 text-[9px] font-semibold text-slate-600">Try: {item.practice_project}</div><div className="mt-2 flex flex-wrap gap-1.5">{item.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[8px] font-semibold text-brand-700 hover:bg-brand-100">{resource.title}<ArrowUpRight size={10} /></a>)}</div></div><span className="whitespace-nowrap text-[8px] text-slate-400">{item.estimated_duration}</span></div></div>; })}</div> : <div className="rounded-lg bg-slate-50 p-3 text-[9px] leading-4 text-slate-500">{week === 2 ? "Use this week to build and document a small project." : "Review what you have learned and plan your next practice step."}</div>}</Card>)}</div>
    <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-4 text-[9px] leading-4 text-amber-800"><Lightbulb size={15} className="mt-0.5 shrink-0" /> Learning durations are rough estimates. Adjust the plan to your starting point and available time.</div>
  </div>;
}

function AnalysisDetails({ analysis, resumeText, onImprove: requestImprovement, improving, improved, onDownloadResume }) {
  const [open, setOpen] = useState(0);
  const [activeItem, setActiveItem] = useState(null);
  const [sectionText, setSectionText] = useState("");
  const onImprove = (item, text) => {
    if (text !== undefined) {
      requestImprovement(item, text);
      return;
    }
    setActiveItem(item);
    setSectionText(extractSection(resumeText, item.section));
  };
  return <div className="mt-5 fade-in"><Card className="p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="heading-font text-[16px] font-bold text-ink">Resume improvement ideas</h2>{analysis.demo_mode && <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-bold text-amber-700">DEMO MODE</span>}</div><p className="mt-1 text-[10px] text-slate-400">Practical suggestions; verify all details and keep your real experience intact.</p></div><WandSparkles size={17} className="text-brand-500" /></div><div className="space-y-3">{analysis.resume_improvements.map((item, index) => <div key={`${item.section}-${index}`} className="rounded-xl border border-slate-100"><button onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center gap-3 p-3 text-left"><span className={`rounded-md px-2 py-1 text-[8px] font-bold ${item.priority === "High" ? "bg-rose-50 text-rose-700" : item.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{item.priority}</span><span className="flex-1 text-[10px] font-bold text-ink">{item.section}</span><span className="hidden text-[9px] text-slate-500 sm:block">{item.issue}</span><ChevronDown size={14} className={`text-slate-400 transition ${open === index ? "rotate-180" : ""}`} /></button>{open === index && <div className="border-t border-slate-100 px-4 pb-4 pt-3"><p className="text-[10px] leading-5 text-slate-500"><b className="text-slate-700">Issue:</b> {item.issue}<br /><b className="text-slate-700">Why:</b> {item.why}<br /><b className="text-slate-700">Suggestion:</b> {item.suggestion}</p><button disabled={improving} onClick={() => onImprove(item)} className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[9px] font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50">{improving ? <LoaderCircle size={12} className="animate-spin" /> : <WandSparkles size={12} />} Generate preview</button></div>}</div>)}</div>
      {activeItem && <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4"><div className="mb-2 text-[10px] font-bold text-ink">Text from your {activeItem.section.toLowerCase()} section</div><textarea value={sectionText} onChange={(event) => setSectionText(event.target.value)} placeholder="Paste only the section you want to improve. Review it carefully before using the suggestion." className="min-h-[105px] w-full rounded-lg border border-brand-100 bg-white p-3 text-[10px] leading-5 text-slate-600 placeholder:text-slate-300" /><div className="mt-2 flex justify-end"><button disabled={improving || !sectionText.trim()} onClick={() => onImprove(activeItem, sectionText)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[9px] font-bold text-white disabled:opacity-50">{improving ? <LoaderCircle size={12} className="animate-spin" /> : <WandSparkles size={12} />} Generate preview</button></div></div>}
      {improved && <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/40 p-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-bold text-ink">Preview · {improved.section}</h3><button onClick={onDownloadResume} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[9px] font-bold text-brand-700 shadow-sm"><ArrowDownToLine size={12} /> Export DOCX</button></div><div className="grid gap-3 md:grid-cols-2"><div><div className="mb-1 text-[9px] font-bold text-slate-500">Original text</div><textarea readOnly value={improved.original} className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white p-3 text-[10px] leading-5 text-slate-600" /></div><div><div className="mb-1 text-[9px] font-bold text-slate-500">Suggested revision</div><textarea readOnly value={improved.suggested} className="min-h-[120px] w-full rounded-lg border border-brand-100 bg-white p-3 text-[10px] leading-5 text-slate-600" /></div></div><p className="mt-2 text-[9px] text-slate-500">{improved.note}</p><p className="mt-1 text-[9px] text-slate-500">DOCX export includes your original resume with the first matching section text replaced by this suggestion.</p></div>}
    </Card>
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-100 bg-white p-4 text-[9px] leading-4 text-slate-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /> AI suggestions may need correction. Never add unsupported experience, qualifications, metrics, or outcomes.</div></div>;
}

function EmptyState({ title, message, onAnalyze }) {
  return <div className="fade-in"><PageTitle eyebrow="CareerLens workspace" title={title} description={message} /><Card className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><FileText size={23} /></span><h2 className="heading-font mt-4 text-[16px] font-bold text-ink">Start with your resume</h2><p className="mt-2 max-w-sm text-[10px] leading-5 text-slate-500">{message}</p><button onClick={onAnalyze} className="mt-5 flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-[10px] font-bold text-white hover:bg-brand-700">Analyze a resume <ArrowRight size={13} /></button></Card></div>;
}

function ProfilePage({ onClear, historyCount }) {
  const [confirm, setConfirm] = useState(false);
  return <div className="fade-in"><PageTitle eyebrow="Your workspace" title="Privacy & preferences" description="CareerLens AI is designed as a private, single-session guidance tool. No student account is required." />
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <Card className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700"><GraduationCap size={20} /></span><div><div className="text-[13px] font-bold text-ink">Student workspace</div><div className="mt-1 text-[10px] text-slate-400">No account or profile information collected</div></div></div><div className="mt-5 space-y-3 border-t border-slate-100 pt-4"><InfoRow icon={ShieldCheck} title="Resume storage" detail="Resume text is held in this browser session and not stored by the API." /><InfoRow icon={LockKeyhole} title="AI processing" detail="If enabled, resume text is sent to the configured AI provider. Check your placement cell's privacy policy." /><InfoRow icon={Clock3} title="Analysis history" detail={`${historyCount} ${historyCount === 1 ? "analysis" : "analyses"} held in memory for this session only.`} /></div></Card>
      <Card className="p-5 sm:p-6"><h2 className="heading-font text-[14px] font-bold text-ink">Manage your data</h2><p className="mt-2 text-[10px] leading-5 text-slate-500">Clear your resume text, analysis results, suggestions, and session history from this browser. The backend does not save these records.</p><div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/50 p-4"><div className="flex gap-3"><Trash2 size={16} className="mt-0.5 text-rose-600" /><div className="flex-1"><div className="text-[11px] font-bold text-rose-900">Clear session data</div><p className="mt-1 text-[9px] leading-4 text-rose-800/80">This cannot be undone. You can upload your resume again later.</p>{confirm ? <div className="mt-3 flex gap-2"><button onClick={() => { onClear(); setConfirm(false); }} className="rounded-lg bg-rose-600 px-3 py-2 text-[9px] font-bold text-white">Confirm clear</button><button onClick={() => setConfirm(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold text-slate-600">Cancel</button></div> : <button onClick={() => setConfirm(true)} className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[9px] font-bold text-rose-700 hover:bg-rose-50">Clear my session</button>}</div></div></div><div className="mt-5 flex gap-2 text-[9px] leading-4 text-slate-400"><CircleHelp size={13} className="mt-0.5 shrink-0" /> CareerLens AI does not provide legal, employment, or placement guarantees.</div></Card>
    </div>
  </div>;
}

function InfoRow({ icon: Icon, title, detail }) {
  return <div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><Icon size={14} /></span><div><div className="text-[10px] font-bold text-ink">{title}</div><div className="mt-1 text-[9px] leading-4 text-slate-500">{detail}</div></div></div>;
}

function humanize(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractSection(text, section) {
  const aliases = {
    projects: ["projects", "project experience"],
    experience: ["experience", "work experience", "employment", "internships"],
    skills: ["skills", "technical skills"],
    education: ["education", "qualifications"],
    summary: ["summary", "profile", "objective"],
  };
  const keys = aliases[section.toLowerCase()] || [section.toLowerCase()];
  const headings = /^(education|qualifications|experience|work experience|employment|internships?|projects?|technical skills|skills|certifications?|summary|profile|objective|achievements)\s*:?\s*$/i;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => keys.includes(line.trim().replace(/:$/, "").toLowerCase()));
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !headings.test(lines[end].trim())) end += 1;
  return lines.slice(start + 1, end).join("\n").trim();
}

export default App;
