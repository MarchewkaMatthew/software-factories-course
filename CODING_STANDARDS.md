# Coding standards

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

## Parse untrusted input with a schema

Form data, search parameters and request bodies get a zod schema before the
values reach any query. Do not read `formData.get("x") as string`. The cast
is a lie the type checker believes.

## Do not write `any`, and do not write `!`

Both switch the type checker off at the exact point you are least sure. If a
value can be missing, narrow it with a check. If you cannot name the type,
the shape is wrong — fix the shape.

## Give each piece of UI a named component

A route component composes. When JSX sits inside a `.map()` or a
conditional branch (`? :`, `&&`, an early `return`), give it a component
of its own when the markup is more than a line or two:

```tsx
<ul>
  {bookmarks.map((bookmark) => (
    <li key={bookmark.id}>
      <BookmarkCard bookmark={bookmark} />
    </li>
  ))}
</ul>
{notes.length === 0 ? <EmptyNotes /> : <NoteList notes={notes} />}
```

The name says what the markup is, and its props show what it depends on.

This is a judgement call. Leave the JSX inline when a component would add
more than it explains: a one- or two-line snippet such as a single `<li>`
or an icon with a label, where the component name only restates the
markup and the reader has to jump away to see it.

Put a component used by one route in that route's file. Move it to
`app/components/` once a second route uses it.

### The parent owns the semantic element

The element that gives the markup its place in the document stays in the
parent: the `<li>` around each mapped item, and the `<section>`,
`<article>` or `<nav>` around a region. The parent then reads as the
page's outline, and the component works inside any list or region. A
component's root is almost always a `<div>`.
