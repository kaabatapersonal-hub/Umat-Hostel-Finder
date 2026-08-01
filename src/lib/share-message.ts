// The one shared piece of copy across every share flow (Buzz posts,
// marketplace listings, seller sale pages) -- centralized so the pitch
// wording can't quietly drift out of sync between the two separate share
// implementations (useShare's hook and ShareButton's own inline one).
// Deliberately no second URL in here: the url already being shared (a
// listing/post/sale-page link) already lands the recipient inside the
// app, where they can browse and sign up -- a second, different link
// would just be confusing.
export function joinCampaPitch(): string {
  return "\n\n📱 Join Campa — UMaT hostels, buzz & marketplace";
}
