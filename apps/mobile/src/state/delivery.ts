// The hash an order commits to instead of the delivery address itself. The
// salt keeps a known address from being matched against it.
import type { Hex } from "viem";
import type { DeliveryAddress } from "../wallet/local";
import { hashCanonical } from "../wallet/service-validation";

export const deliveryHash = (a: DeliveryAddress): Hex =>
  hashCanonical({
    name: a.name,
    line1: a.line1,
    city: a.city,
    postcode: a.postcode,
    country: a.country,
    salt: a.salt,
  });

export const deliveryLine = (a: DeliveryAddress) =>
  `${a.name}, ${a.line1}, ${a.city} ${a.postcode}, ${a.country}`;
