// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Fixed S2 ceilings and protocol bounds shared by the wallet and its libraries.
uint256 constant CHAIN_ID = 84532;
uint256 constant MAX_PAYMENT = 500_000;
uint256 constant MAX_TASK_SPEND = 2_000_000;
uint256 constant MAX_EXECUTOR_DAY = 5_000_000;
uint256 constant MAX_WALLET_DAY = 10_000_000;
uint256 constant MAX_WALLET_WEEK = 25_000_000;
uint256 constant MIN_LIQUID_FLOOR = 3_000_000;
uint32 constant MAX_ACTIONS = 20;
uint32 constant MAX_BROWSER_PAYMENTS = 3;
uint64 constant MAX_PERMIT_SECONDS = 1 days;
uint64 constant MAX_ALLOWANCE_SECONDS = 30 days;
uint32 constant MAX_ALLOWANCE_ACTIONS = 200;
uint256 constant MAX_POLICY_LIST = 32;
uint256 constant MAX_POLICY_TEMPLATES = 8;
uint64 constant MAX_ACTION_SECONDS = 60;
uint64 constant MAX_COSIGNED_SECONDS = 15 minutes;
uint64 constant MAX_OWNER_TRANSFER_SECONDS = 10 minutes;
uint64 constant MAX_ADMIN_SECONDS = 30 minutes;
uint256 constant MAX_ALLOCATION_BPS = 2_000;
// Gas forwarded to the vault during RECOVER. A misbehaving vault cannot block recovery.
uint256 constant RECOVER_VIEW_GAS = 50_000;
uint256 constant RECOVER_REDEEM_GAS = 300_000;
