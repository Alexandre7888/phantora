When fetching or managing user posts from Firebase
- Maintain the "Fan-out" (desnormalization) architecture.
- For pagination, first fetch the post IDs (e.g., in batches of 10) from the user's reference node (`/users/{userId}/user_posts`).
- Then, fetch the complete post data from the general `/posts/{postId}` node using the retrieved IDs.
- Avoid using `.indexOn: ["authorId"]` or querying the entire `/posts` node directly to filter by author, as the Fan-out approach is much faster and saves bandwidth.