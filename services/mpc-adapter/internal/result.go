package internal

import (
	"github.com/fystack/mpcium/pkg/event"
	boundary "mandate.local/mpc-boundary"
)

func (a *Adapter) result(e event.SigningResultEvent) {
	a.mu.Lock()
	defer a.mu.Unlock()
	p := a.pending
	if p == nil || e.ResultType != event.ResultTypeSuccess || e.WalletID != p.record.WalletID || e.TxID != p.record.AttemptID || e.NetworkInternalCode != boundary.Network {
		return
	}
	sig, err := boundary.Normalize(p.record.Digest, e.R, e.S, e.SignatureRecovery, p.record.Executor)
	if err != nil {
		return
	}
	select {
	case p.result <- sig:
	default:
	}
}
