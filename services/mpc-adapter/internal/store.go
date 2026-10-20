package internal

import (
	"context"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	boundary "mandate.local/mpc-boundary"
)

var ErrNotSigning = errors.New("action is not awaiting signature")

// PgStore journals attempts in the shared financial database. Records are
// selected only by action ID; nothing comes from the caller's request body.
type PgStore struct{ DB *pgxpool.Pool }

func now() int64 { return time.Now().Unix() }

func decodeDigest(s string) ([32]byte, error) {
	b, err := hex.DecodeString(strings.TrimPrefix(s, "0x"))
	if err != nil || len(b) != 32 {
		return [32]byte{}, errors.New("stored digest is not 32 bytes")
	}
	return [32]byte(b), nil
}

const attemptColumns = "s.id::text,s.action_id::text,s.mpc_wallet_id::text,s.key_version,s.executor_address,s.digest,s.state,COALESCE(s.signature,'')"

func scanAttempt(row pgx.Row) (Attempt, error) {
	var a Attempt
	var version int
	var digest, state, signature string
	err := row.Scan(&a.Record.AttemptID, &a.Record.ActionID, &a.Record.WalletID, &version, &a.Record.Executor, &digest, &state, &signature)
	if err != nil {
		return a, err
	}
	a.Record.KeyVersion = strconv.Itoa(version)
	if a.Record.Digest, err = decodeDigest(digest); err != nil {
		return a, err
	}
	a.State = map[string]string{"PENDING": "PREPARED", "UNKNOWN": "SIGNING_UNKNOWN"}[state]
	if a.State == "" {
		a.State = state
	}
	if signature != "" {
		a.Signature, err = hex.DecodeString(strings.TrimPrefix(signature, "0x"))
	}
	return a, err
}

// Begin returns the open or signed attempt, or journals a new one. The partial
// unique index allows one PENDING/UNKNOWN attempt per action.
func (s PgStore) Begin(ctx context.Context, actionID string) (Attempt, bool, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Attempt{}, false, err
	}
	defer tx.Rollback(context.WithoutCancel(ctx))
	var state, digest, mpcWallet, executor string
	var version int
	err = tx.QueryRow(ctx,
		"SELECT a.state,a.digest,w.mpc_wallet_id::text,w.key_version,w.executor_address FROM actions a JOIN wallets w ON w.id=a.wallet_id WHERE a.id=$1 AND w.provisioning_state='READY' FOR UPDATE OF a",
		actionID).Scan(&state, &digest, &mpcWallet, &version, &executor)
	if err != nil {
		return Attempt{}, false, err
	}
	existing, err := scanAttempt(tx.QueryRow(ctx,
		"SELECT "+attemptColumns+" FROM signing_attempts s WHERE s.action_id=$1 AND s.state IN ('PENDING','UNKNOWN','SIGNED') ORDER BY s.state='SIGNED' DESC LIMIT 1", actionID))
	if err == nil {
		return existing, false, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Attempt{}, false, err
	}
	if state != "SIGNING" {
		return Attempt{}, false, ErrNotSigning
	}
	d, err := decodeDigest(digest)
	if err != nil {
		return Attempt{}, false, err
	}
	a := Attempt{State: "PREPARED", Record: boundary.Record{ActionID: actionID, AttemptID: uuid.NewString(), WalletID: mpcWallet, KeyVersion: strconv.Itoa(version), Executor: executor, Digest: d}}
	if _, err = tx.Exec(ctx,
		"INSERT INTO signing_attempts(id,action_id,mpc_wallet_id,key_version,digest,executor_address,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'PENDING',$7,$7)",
		a.Record.AttemptID, actionID, mpcWallet, version, digest, executor, now()); err != nil {
		return Attempt{}, false, err
	}
	return a, true, tx.Commit(ctx)
}

func (s PgStore) Save(ctx context.Context, a Attempt) error {
	var err error
	switch a.State {
	case "SIGNING_UNKNOWN":
		_, err = s.DB.Exec(ctx, "UPDATE signing_attempts SET state='UNKNOWN',message_fingerprint=$2,updated_at=$3 WHERE id=$1 AND state='PENDING'",
			a.Record.AttemptID, hex.EncodeToString(a.Fingerprint[:]), now())
	case "SIGNED":
		_, err = s.DB.Exec(ctx, "UPDATE signing_attempts SET state='SIGNED',signature=$2,updated_at=$3 WHERE id=$1 AND state IN ('PENDING','UNKNOWN')",
			a.Record.AttemptID, "0x"+hex.EncodeToString(a.Signature), now())
	case "DENIED", "ABORTED":
		_, err = s.DB.Exec(ctx, "UPDATE signing_attempts SET state=$2,updated_at=$3 WHERE id=$1 AND state='PENDING'",
			a.Record.AttemptID, a.State, now())
	default:
		err = errors.New("unsupported attempt state " + a.State)
	}
	return err
}

func (s PgStore) Unresolved(ctx context.Context, attemptID string) (Attempt, bool, error) {
	if _, err := uuid.Parse(attemptID); err != nil {
		return Attempt{}, false, nil
	}
	a, err := scanAttempt(s.DB.QueryRow(ctx, "SELECT "+attemptColumns+" FROM signing_attempts s WHERE s.id=$1 AND s.state='UNKNOWN'", attemptID))
	if errors.Is(err, pgx.ErrNoRows) {
		return a, false, nil
	}
	return a, err == nil, err
}

// Latest is the status the worker polls for an action.
func (s PgStore) Latest(ctx context.Context, actionID string) (Attempt, bool, error) {
	a, err := scanAttempt(s.DB.QueryRow(ctx, "SELECT "+attemptColumns+" FROM signing_attempts s WHERE s.action_id=$1 ORDER BY s.created_at DESC,s.id DESC LIMIT 1", actionID))
	if errors.Is(err, pgx.ErrNoRows) {
		return a, false, nil
	}
	return a, err == nil, err
}

type KeygenStatus struct {
	State     string `json:"state"`
	PublicKey string `json:"publicKey,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

// BeginKeygen journals a ceremony once per planned wallet ID; fresh is true only
// for the call that may start it.
func (s PgStore) BeginKeygen(ctx context.Context, walletID string) (KeygenStatus, bool, error) {
	tag, err := s.DB.Exec(ctx,
		"INSERT INTO mpc_keygen(mpc_wallet_id,state,created_at,updated_at) SELECT $1,'PENDING',$2,$2 WHERE EXISTS (SELECT 1 FROM wallets WHERE mpc_wallet_id=$1 AND provisioning_state='KEYGEN') ON CONFLICT DO NOTHING",
		walletID, now())
	if err != nil {
		return KeygenStatus{}, false, err
	}
	status, ok, err := s.Keygen(ctx, walletID)
	if err == nil && !ok {
		err = errors.New("wallet is not awaiting keygen")
	}
	return status, tag.RowsAffected() == 1, err
}

func (s PgStore) Keygen(ctx context.Context, walletID string) (KeygenStatus, bool, error) {
	var k KeygenStatus
	var key, reason *string
	err := s.DB.QueryRow(ctx, "SELECT state,public_key,failure_reason FROM mpc_keygen WHERE mpc_wallet_id=$1", walletID).Scan(&k.State, &key, &reason)
	if errors.Is(err, pgx.ErrNoRows) {
		return k, false, nil
	}
	if key != nil {
		k.PublicKey = *key
	}
	if reason != nil {
		k.Reason = *reason
	}
	return k, err == nil, err
}

func (s PgStore) FinishKeygen(ctx context.Context, walletID string, k KeygenStatus) error {
	var key, reason any
	if k.PublicKey != "" {
		key = k.PublicKey
	}
	if k.Reason != "" {
		reason = k.Reason
	}
	_, err := s.DB.Exec(ctx, "UPDATE mpc_keygen SET state=$2,public_key=$3,failure_reason=$4,updated_at=$5 WHERE mpc_wallet_id=$1 AND state='PENDING'",
		walletID, k.State, key, reason, now())
	return err
}
