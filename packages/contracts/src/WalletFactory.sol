// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateWallet} from "./MandateWallet.sol";

/// @notice Permissionless, fixed-configuration wallet factory. Anyone may relay
/// creation for any owner; the caller gains no privilege and cannot choose limits,
/// token or vault. One canonical wallet per owner (CREATE2, salt = owner).
contract WalletFactory {
  address public immutable token;
  address public immutable vault;
  mapping(address => address) public walletForOwner;

  event WalletCreated(address indexed owner, address indexed wallet);

  error ZeroAddress();

  constructor(address token_, address vault_) {
    if (token_ == address(0)) revert ZeroAddress();
    token = token_;
    vault = vault_;
  }

  function createWallet(address owner) external returns (address wallet) {
    if (owner == address(0)) revert ZeroAddress();
    wallet = walletForOwner[owner];
    if (wallet != address(0)) return wallet;
    wallet = address(new MandateWallet{salt: bytes32(uint256(uint160(owner)))}(owner, token, vault));
    walletForOwner[owner] = wallet;
    emit WalletCreated(owner, wallet);
  }

  function predictWallet(address owner) external view returns (address) {
    bytes32 initHash = keccak256(abi.encodePacked(type(MandateWallet).creationCode, abi.encode(owner, token, vault)));
    return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), bytes32(uint256(uint160(owner))), initHash)))));
  }
}
