export const terminology = {
  lien: {
    title: "Lien",
    description:
      "A lien is a legal claim or financial obligation attached to a property, such as an unpaid mortgage or debt. It may affect whether the property can be sold or transferred.",
  },
  registeredTitleDocument: {
    title: "Registered Title Document",
    description:
      "A legal document used to establish or support ownership or rights to a property, such as a Certificate of Occupancy or Deed of Assignment.",
  },
  salesMandate: {
    title: "Sales Mandate",
    description:
      "A document authorizing Beryl Shelter to assist with marketing or selling your property under agreed terms.",
  },
  buyMandate: {
    title: "Buy Mandate",
    description:
      "A document authorizing Beryl Shelter to assist you in searching for or buying a property based on your requirements.",
  },
  minimumDownPayment: {
    title: "Minimum Down Payment",
    description:
      "The smallest initial payment you are willing to accept, expressed as a percentage of the property's total selling price.",
  },
  authorizedThisSale: {
    title: "Authorized This Sale",
    description:
      "Confirms whether you own the property or have permission or authority from the owner to offer it for sale.",
  },
  propertySubtype: {
    title: "Property Subtype",
    description:
      "A more specific kind of property within the selected category, such as a detached duplex, semi-detached duplex or flat.",
  },
  landArea: {
    title: "Land Area",
    description:
      "The size of the land associated with the property, using the measurement unit shown on the form.",
  },
  mortgage: {
    title: "Mortgage",
    description: "A loan used to purchase a property, typically repaid over time with interest.",
  },
  transferableGifts: {
    title: "Transferable Gifts",
    description:
      "Describe any gifts or benefits associated with the transaction that you believe may be transferred to the other party.",
  },
} as const;

export type TerminologyKey = keyof typeof terminology;
