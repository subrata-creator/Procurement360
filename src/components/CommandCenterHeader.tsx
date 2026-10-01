import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronDown, Search } from "lucide-react";
import { purchaseRequests } from "../Pages/Purchaserequestsdata";
import { taskInboxItems } from "../data/tasks";
import "../Styles/CommandCenter.css";

type SearchResult = {
  title: string;
  detail: string;
  path: string;
  department?: string;
};

type Props = {
  onCreatePR: () => void;
  onNavigate: (path: string) => void;
};

export default function CommandCenterHeader({ onCreatePR, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [department, setDepartment] = useState("All Departments");
  const [period, setPeriod] = useState("Last 30 days");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  const searchResults: SearchResult[] = [
    ...purchaseRequests.map((request) => ({
      title: request.ref,
      detail: request.title,
      path: `/purchase-requests/${request.ref}`,
      department: request.department,
    })),
    ...taskInboxItems.map((task) => ({
      title: task.taskName,
      detail: `${task.taskType} · Assigned ${task.assignedOn}`,
      path: `/tasks/${task.id}`,
      department: undefined,
    })),
  ].filter((result) => {
    const matchesDepartment = department === "All Departments" || !result.department || result.department === department;
    const matchesQuery = !query.trim() || `${result.title} ${result.detail}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesDepartment && matchesQuery;
  }).slice(0, 6);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <header className="command-header">
      <div className="command-heading-row">
        <div className="command-title">
          <span className="command-eyebrow">PROCUREMENT INTELLIGENCE</span>
          <h1>Procurement Command Center</h1>
          <p>{greeting}. Here’s what needs your attention today.</p>
        </div>

        <div className="command-tools">
          <label className="command-select-wrap">
            <CalendarDays size={14} aria-hidden="true" />
            <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Dashboard date range">
              <option>Last 30 days</option>
              <option>Quarter to date</option>
              <option>Year to date</option>
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <label className="command-select-wrap department-select-wrap">
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
              <option>All Departments</option>
              <option>Information Technology</option>
              <option>Administration</option>
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <button className="dashboard-icon-button command-notifications" type="button" aria-label="Notifications">
            <Bell size={16} strokeWidth={1.8} />
            <i aria-hidden="true" />
          </button>
          <button className="dashboard-create-button" type="button" onClick={onCreatePR}>
            <span className="create-plus">+</span>
            Create Purchase Request
          </button>
        </div>
      </div>

      <div className="command-context-row">
        <span className="command-context-chip priority"><i />3 approvals need attention</span>
        <span className="command-context-chip budget"><i />IT budget at 85%</span>
        <span className="command-context-chip intelligence"><i />3 AI recommendations</span>
        <div
          className="command-search"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsSearchOpen(false);
          }}
        >
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setIsSearchOpen(true); }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsSearchOpen(false);
              if (event.key === "Enter" && searchResults[0]) {
                onNavigate(searchResults[0].path);
                setIsSearchOpen(false);
              }
            }}
            placeholder="Search PRs, tasks, suppliers..."
            aria-label="Search procurement records"
            aria-expanded={isSearchOpen && Boolean(query.trim())}
          />
          <kbd>⌘ K</kbd>
          {isSearchOpen && query.trim() && (
            <div className="command-search-results" role="listbox" aria-label="Search results">
              {searchResults.length ? searchResults.map((result) => (
                <button
                  type="button"
                  role="option"
                  key={`${result.path}-${result.title}`}
                  onClick={() => { onNavigate(result.path); setQuery(""); setIsSearchOpen(false); }}
                >
                  <strong>{result.title}</strong>
                  <span>{result.detail}</span>
                </button>
              )) : <p>No matching procurement records.</p>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}