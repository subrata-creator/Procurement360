import { useState } from "react";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CircleAlert, CircleCheck, Gauge, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { taskInboxItems } from "../data/tasks";
import "../Styles/CommandCenter.css";

type Props = {
  onViewPRs: () => void;
  onOpenTask: (id: number) => void;
  onViewForecast: () => void;
};

const delayedPRs = 3;
const itBudgetUsage = 85;
const highPriorityTasks = taskInboxItems.filter((task) => task.priority === "High");
const healthScore = Math.max(0, 100 - delayedPRs * 2 - Math.max(0, itBudgetUsage - 75));

const suppliers = [
  { name: "ITC", orders: 100 },
  { name: "Logitech", orders: 92 },
  { name: "TechScan", orders: 70 },
  { name: "Pidilite", orders: 40 },
  { name: "Dell Inc.", orders: 25 },
];
const supplierOrderTotal = suppliers.reduce((sum, supplier) => sum + supplier.orders, 0);
const leadingSupplierShare = Math.round((suppliers[0].orders / supplierOrderTotal) * 100);

export default function CommandCenterPanels({ onViewPRs, onOpenTask, onViewForecast }: Props) {
  const [spendPeriod, setSpendPeriod] = useState("Monthly");
  const [spendDepartment, setSpendDepartment] = useState("All departments");
  const [spendSupplier, setSpendSupplier] = useState("All suppliers");
  const [spendCategory, setSpendCategory] = useState("All categories");

  return (
    <>
      <section className="cc-executive-grid" aria-label="Procurement health and attention">
        <article className="cc-panel cc-health-panel">
          <div className="cc-section-heading">
            <div>
              <span className="cc-eyebrow">AT A GLANCE</span>
              <h2>Procurement Health</h2>
            </div>
            <button className="cc-text-action" type="button" onClick={onViewPRs}>View analysis <ArrowUpRight size={14} /></button>
          </div>
          <div className="cc-health-content">
            <div className="cc-health-ring" role="img" aria-label={`Composite procurement health index ${healthScore} out of 100`} style={{ "--health-score": `${healthScore}%` } as React.CSSProperties}>
              <div className="cc-health-ring-inner">
                <strong>{healthScore}</strong>
                <span>of 100</span>
              </div>
            </div>
            <div className="cc-health-details">
              <span className="cc-health-status"><CircleCheck size={14} /> Stable with watch items</span>
              <p>Composite demo index from review delays and IT budget utilization.</p>
              <div className="cc-health-signals">
                <span><i className="positive" />Approval velocity <b>+30%</b></span>
                <span><i className="attention" />IT allocation <b>{itBudgetUsage}%</b></span>
                <span><i className="positive" />RFQ conversion <b>82%</b></span>
              </div>
            </div>
          </div>
        </article>

        <article className="cc-panel cc-attention-panel">
          <div className="cc-section-heading">
            <div>
              <span className="cc-eyebrow">ACTION QUEUE</span>
              <h2>Needs Your Attention <span>{2 + Number(highPriorityTasks.length > 0)}</span></h2>
            </div>
            <CircleAlert size={18} className="cc-attention-icon" />
          </div>
          <div className="cc-attention-list">
            <div className="cc-attention-item critical">
              <span className="cc-attention-symbol"><CircleAlert size={15} /></span>
              <div className="cc-attention-copy">
                <strong>{delayedPRs} purchase requests delayed</strong>
                <span>Waiting for review more than 7 days</span>
              </div>
              <button type="button" onClick={onViewPRs} aria-label="Review delayed purchase requests"><ArrowRight size={15} /></button>
            </div>
            <div className="cc-attention-item warning">
              <span className="cc-attention-symbol"><Gauge size={15} /></span>
              <div className="cc-attention-copy">
                <strong>IT budget at {itBudgetUsage}%</strong>
                <span>Review upcoming requests against allocation</span>
              </div>
              <button type="button" onClick={onViewPRs} aria-label="Review budget-related requests"><ArrowRight size={15} /></button>
            </div>
            <div className="cc-attention-item neutral">
              <span className="cc-attention-symbol"><BriefcaseBusiness size={15} /></span>
              <div className="cc-attention-copy">
                <strong>{highPriorityTasks.length} high-priority tasks</strong>
                <span>Across invoice, PR, and PO approvals</span>
              </div>
              <button type="button" onClick={() => onOpenTask(highPriorityTasks[0]?.id ?? 1)} aria-label="Open a high-priority task"><ArrowRight size={15} /></button>
            </div>
          </div>
        </article>
      </section>

      <section className="cc-panel cc-intelligence-panel">
        <div className="cc-section-heading">
          <div>
            <span className="cc-eyebrow cc-ai-eyebrow"><Sparkles size={12} /> INTELLIGENCE LAYER</span>
            <h2>Procurement Intelligence</h2>
            <p>Recommendations based on current dashboard signals</p>
          </div>
          <span className="cc-ai-availability"><i />3 insights</span>
        </div>
        <div className="cc-intelligence-grid">
          <article className="cc-insight-card process">
            <div className="cc-insight-card-heading"><span>PROCESS RISK</span><ShieldAlert size={15} /></div>
            <h3>Review queue is aging</h3>
            <p>{delayedPRs} purchase requests have been under review for more than 7 days.</p>
            <div className="cc-insight-source">Source <b>Purchase Request Journey</b></div>
            <button type="button" onClick={onViewPRs}>Review PRs <ArrowRight size={13} /></button>
          </article>
          <article className="cc-insight-card budget">
            <div className="cc-insight-card-heading"><span>BUDGET WATCH</span><Gauge size={15} /></div>
            <h3>IT budget utilization is elevated</h3>
            <p>Information Technology is at {itBudgetUsage}% of allocation. Check planned requests before approval.</p>
            <div className="cc-insight-source">Source <b>Allocated Budget KPI</b></div>
            <button type="button" onClick={onViewPRs}>Review budget context <ArrowRight size={13} /></button>
          </article>
          <article className="cc-insight-card forecast">
            <div className="cc-insight-card-heading"><span>FORECAST</span><TrendingUp size={15} /></div>
            <h3>RFQ volume may rise 18%</h3>
            <p>Current trend points to higher RFQ activity next month. Prepare review capacity accordingly.</p>
            <div className="cc-insight-source">Source <b>Monthly RFQ chart</b></div>
            <button type="button" onClick={onViewForecast}>View forecast <ArrowRight size={13} /></button>
          </article>
        </div>
      </section>

      <section className="cc-intelligence-grid secondary">
        <article className="cc-panel cc-spend-panel">
          <div className="cc-section-heading">
            <div>
              <span className="cc-eyebrow">BUDGET POSITION</span>
              <h2>Spend Intelligence</h2>
            </div>
          </div>
          <div className="cc-spend-controls">
            <div className="cc-spend-period" role="group" aria-label="Spend trend period">
              {["Monthly", "Quarterly", "Yearly"].map((period) => (
                <button type="button" key={period} className={spendPeriod === period ? "active" : ""} aria-pressed={spendPeriod === period} onClick={() => setSpendPeriod(period)}>{period}</button>
              ))}
            </div>
            <label><span>Department</span><select value={spendDepartment} onChange={(event) => setSpendDepartment(event.target.value)}><option>All departments</option><option>Information Technology</option><option>Administration</option></select></label>
            <label><span>Supplier</span><select value={spendSupplier} onChange={(event) => setSpendSupplier(event.target.value)}><option>All suppliers</option>{suppliers.map((supplier) => <option key={supplier.name}>{supplier.name}</option>)}</select></label>
            <label><span>Category</span><select value={spendCategory} onChange={(event) => setSpendCategory(event.target.value)}><option>All categories</option><option>IT Hardware</option><option>Office Supplies</option><option>Workplace Safety</option></select></label>
          </div>
          <div className="cc-spend-metrics">
            <div><span>Allocated</span><strong>USD 10.00M</strong></div>
            <div><span>Remaining</span><strong>USD 9.90M</strong></div>
            <div><span>Utilized</span><strong>1%</strong></div>
          </div>
          <div className="cc-spend-trend-empty">
            <span className="cc-spend-trend-grid" aria-hidden="true"><i /><i /><i /></span>
            <div><strong>{spendPeriod} spend trend unavailable</strong><span>Historical spend, savings, and avoided-cost series are not included in this dataset.</span></div>
          </div>
          <div className="cc-budget-track" role="progressbar" aria-label="Overall budget utilized" aria-valuemin={0} aria-valuemax={100} aria-valuenow={1}>
            <span />
          </div>
          <div className="cc-spend-footer"><span><i />Current allocation snapshot</span><span>Savings target <b>Not configured</b></span></div>
        </article>

        <article className="cc-panel cc-supplier-panel">
          <div className="cc-section-heading">
            <div>
              <span className="cc-eyebrow">SUPPLIER LANDSCAPE</span>
              <h2>Supplier Intelligence</h2>
            </div>
            <span className="cc-supplier-count">{suppliers.length} suppliers shown</span>
          </div>
          <div className="cc-supplier-summary">
            <div><span>Leading supplier</span><strong>ITC <small>100 orders</small></strong></div>
            <div><span>Order concentration</span><strong>{leadingSupplierShare}% <small>of charted orders</small></strong></div>
            <div><span>Risk / delivery score</span><strong>Not tracked</strong></div>
          </div>
          <div className="cc-supplier-bars" aria-label="Orders by supplier">
            {suppliers.map((supplier) => (
              <div className="cc-supplier-bar-row" key={supplier.name} title={`${supplier.name}: ${supplier.orders} orders`}>
                <span>{supplier.name}</span>
                <div><i style={{ width: `${supplier.orders}%` }} /></div>
                <b>{supplier.orders}</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}