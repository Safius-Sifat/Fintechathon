// Package qualification is an isolated public-vector record source. It is only
// constructed by the local qualification command; it is not a financial policy.
package qualification

import (
	"context"
	"errors"
	boundary "mandate.local/mpc-boundary"
	"sync"
)

type Records struct {
	mu      sync.Mutex
	records map[string]boundary.Record
	used    map[string]bool
}

func NewRecords() *Records {
	return &Records{records: make(map[string]boundary.Record), used: make(map[string]bool)}
}
func (s *Records) Commit(r boundary.Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.records[r.AttemptID]; ok {
		return errors.New("duplicate attempt")
	}
	s.records[r.AttemptID] = r
	return nil
}
func (s *Records) Load(_ context.Context, action, attempt string) (boundary.Record, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.records[attempt]
	if !ok || r.ActionID != action {
		return r, errors.New("uncommitted action")
	}
	return r, nil
}
func (s *Records) Check(_ context.Context, r boundary.Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	stored, ok := s.records[r.AttemptID]
	if !ok || stored != r || s.used[r.AttemptID] {
		return errors.New("qualification record missing or consumed")
	}
	s.used[r.AttemptID] = true
	return nil
}
