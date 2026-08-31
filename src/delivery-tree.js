'use strict';
class DeliveryTreeProvider {
  constructor(vscode) { this.vscode = vscode; this.emitter = new vscode.EventEmitter(); this.onDidChangeTreeData = this.emitter.event; this.state = {}; }
  dispose() { this.emitter.dispose(); }
  update(patch) { this.state = { ...this.state, ...patch }; this.emitter.fire(); }
  getTreeItem(item) { return item; }
  getChildren() {
    const v = this.vscode; const out = [];
    const add = (label, description, icon, command) => { const item = new v.TreeItem(label, v.TreeItemCollapsibleState.None); item.description = description || ''; item.iconPath = new v.ThemeIcon(icon); if (command) item.command = { command, title: label }; out.push(item); };
    add('Provider', this.state.provider || 'Not resolved', 'repo');
    add('Branch', this.state.branch || 'Run Delivery Preflight', 'git-branch', 'safeCodexChange.preflight');
    add('Preflight', this.state.preflight || 'Not run', this.state.preflight === 'BLOCKED' ? 'error' : this.state.preflight?.startsWith('READY') ? 'pass' : 'circle-outline', 'safeCodexChange.preflight');
    add('Change Request', this.state.change ? `#${this.state.change.number}` : 'Not created / resolved', this.state.change ? 'git-pull-request' : 'git-pull-request-create', this.state.change ? 'safeCodexChange.open' : 'safeCodexChange.createOrUpdate');
    add('Merge Readiness', this.state.readiness || 'Not checked', this.state.readiness === 'READY_TO_MERGE' ? 'pass-filled' : this.state.readiness === 'BLOCKED' ? 'error' : 'clock', 'safeCodexChange.refresh');
    return out;
  }
}
module.exports = { DeliveryTreeProvider };
