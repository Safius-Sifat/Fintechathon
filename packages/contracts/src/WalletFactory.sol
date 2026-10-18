// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateWallet} from "./MandateWallet.sol";

/// @notice Permissionless, fixed-configuration wallet factory. Anyone may relay
/// creation for any owner; the caller gains no privilege and cannot choose limits,
/// token, USDC or vault. One canonical wallet per owner (CREATE2, salt = owner).
///
/// The wallet's creation code is larger than the 24,576-byte runtime limit (EIP-170),
/// so the factory cannot embed it in its own runtime. The constructor (initcode may be
/// up to 49,152 bytes, EIP-3860) splits it into two code-only data contracts (SSTORE2
/// pattern: runtime = 0x00 STOP byte + data) and `createWallet` reassembles it.
contract WalletFactory {
  address public immutable token;
  address public immutable usdc;
  address public immutable vault;
  address private immutable codeA;
  address private immutable codeB;
  mapping(address => address) public walletForOwner;

  event WalletCreated(address indexed owner, address indexed wallet);

  error ZeroAddress();
  error DeploymentFailed();

  constructor(address token_, address usdc_, address vault_) {
    if (token_ == address(0)) revert ZeroAddress();
    token = token_;
    usdc = usdc_;
    vault = vault_;
    bytes memory code = type(MandateWallet).creationCode;
    uint256 half = code.length / 2;
    codeA = _storeCode(_slice(code, 0, half));
    codeB = _storeCode(_slice(code, half, code.length - half));
  }

  function createWallet(address owner) external returns (address wallet) {
    if (owner == address(0)) revert ZeroAddress();
    wallet = walletForOwner[owner];
    if (wallet != address(0)) return wallet;
    bytes memory init = _initCode(owner);
    bytes32 salt = bytes32(uint256(uint160(owner)));
    assembly {
      wallet := create2(0, add(init, 0x20), mload(init), salt)
    }
    if (wallet == address(0)) revert DeploymentFailed();
    walletForOwner[owner] = wallet;
    emit WalletCreated(owner, wallet);
  }

  function predictWallet(address owner) external view returns (address) {
    bytes32 initHash = keccak256(_initCode(owner));
    bytes32 salt = bytes32(uint256(uint160(owner)));
    return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initHash)))));
  }

  /// MandateWallet creation code followed by its ABI-encoded constructor arguments.
  function _initCode(address owner) private view returns (bytes memory init) {
    (address a, address b) = (codeA, codeB);
    uint256 lenA = a.code.length - 1; // skip the leading STOP byte
    uint256 lenB = b.code.length - 1;
    bytes memory args = abi.encode(owner, token, usdc, vault);
    init = new bytes(lenA + lenB + args.length);
    assembly {
      let dst := add(init, 0x20)
      extcodecopy(a, dst, 1, lenA)
      extcodecopy(b, add(dst, lenA), 1, lenB)
      mcopy(add(dst, add(lenA, lenB)), add(args, 0x20), mload(args))
    }
  }

  /// Deploys a contract whose runtime is 0x00 || data, so it can never be executed.
  function _storeCode(bytes memory data) private returns (address pointer) {
    // PUSH4 len, DUP1, PUSH1 14, PUSH1 0, CODECOPY, PUSH1 0, RETURN  (14-byte header)
    bytes memory init = abi.encodePacked(hex"63", uint32(data.length + 1), hex"80600e6000396000f3", hex"00", data);
    assembly {
      pointer := create(0, add(init, 0x20), mload(init))
    }
    if (pointer == address(0)) revert DeploymentFailed();
  }

  function _slice(bytes memory data, uint256 start, uint256 len) private pure returns (bytes memory out) {
    out = new bytes(len);
    assembly {
      mcopy(add(out, 0x20), add(add(data, 0x20), start), len)
    }
  }
}
