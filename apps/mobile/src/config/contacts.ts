import type { CapabilityState } from "./capabilities";

// Contacts (plan P3-W02, S8.1, S8.4). A contact is your own label for an
// address on one network, kept encrypted on this phone. It is a note, not
// proof of who controls the address, and the chain cannot restore it.

export const CONTACTS_STATE: {
  state: CapabilityState;
  title: string;
  body: string;
} = {
  state: "unavailable",
  title: "Contacts are not available yet",
  body: "This build has no protected storage for contacts, so it cannot show, add or check any.",
};

export const CONTACT_FACTS: readonly string[] = [
  "A name is your own note. It is not proof of who controls the address.",
  "Always check the full address on the review screen before you send.",
  "Contacts stay on this phone, encrypted. Restoring your wallet from its words does not bring them back.",
  "Each contact belongs to one network. Base Sepolia is the only one here.",
];

// What a contact holds, in display order.
export const CONTACT_FIELDS: readonly { label: string; detail: string }[] = [
  { label: "Name", detail: "Your own label, shown next to the address" },
  { label: "Address", detail: "Checked and always shown in full" },
  { label: "Network", detail: "Base Sepolia · Chain 84532" },
];

export interface SampleContact {
  label: string;
  // Shown where a real contact's address would be. Never an address.
  addressNote: string;
  chainId: number;
}

// Development samples, __DEV__ only and labelled. They hold no address at
// all, so nothing here can be copied or mistaken for a recipient.
export const SAMPLE_CONTACTS: readonly SampleContact[] = [
  {
    label: "Sample: Alex",
    addressNote: "Sample placeholder, not an address",
    chainId: 84532,
  },
  {
    label: "Sample: Test shop",
    addressNote: "Sample placeholder, not an address",
    chainId: 84532,
  },
];
