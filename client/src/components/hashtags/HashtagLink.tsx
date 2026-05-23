import { Link } from 'react-router-dom';

export function HashtagLink({ tag }: { tag: string }) {
  return (
    <Link to={`/hashtag/${tag}`} className="text-primary-500 hover:underline">
      #{tag}
    </Link>
  );
}

// Helper to render text with hashtags
export function renderWithHashtags(text: string) {
  const parts = text.split(/(#\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return <HashtagLink key={i} tag={part.slice(1)} />;
    }
    return part;
  });
}