import MIC from "@/constants/MODULE_INTERFACE_CONTRACT.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MICPanel = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Version</p>
        <p className="text-sm font-mono">{MIC.version}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Fields</p>
        <p className="text-sm font-mono">{MIC.fields_version}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Schemas</p>
        <p className="text-sm font-mono">{Object.keys(MIC.schemas).length}</p>
      </div>
    </div>
    <div className="space-y-1">
      {Object.keys(MIC.schemas).map((name) => (
        <p key={name} className="text-[10px] font-mono text-muted-foreground">{name}</p>
      ))}
    </div>
    <Dialog>
      <DialogTrigger asChild>
        <button className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors">
          View Contract
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-widest">Module Interface Contract v{MIC.version}</DialogTitle>
        </DialogHeader>
        <pre className="text-xs font-mono text-foreground bg-muted/30 p-4 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(MIC, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  </div>
);

export default MICPanel;
