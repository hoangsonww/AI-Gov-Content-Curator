#!/bin/bash

# Related Articles Carousel - Setup and Test Script

set -e

echo "=========================================="
echo "Related Articles Carousel - Setup Script"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "crawler" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check environment variables
echo "🔍 Checking environment variables..."
if ! grep -q "PINECONE_API_KEY" backend/.env; then
    echo "❌ PINECONE_API_KEY not found in backend/.env"
    exit 1
fi
if ! grep -q "PINECONE_API_KEY" crawler/.env; then
    echo "❌ PINECONE_API_KEY not found in crawler/.env"
    exit 1
fi
echo "✅ Environment variables configured"
echo ""

# Ask user what they want to do
echo "What would you like to do?"
echo "1) Vectorize all existing articles (one-time setup)"
echo "2) Test the API endpoint"
echo "3) Both"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1|3)
        echo ""
        echo "=========================================="
        echo "Vectorizing Articles"
        echo "=========================================="
        echo ""
        echo "This will vectorize all articles in MongoDB and upload to Pinecone."
        echo "This may take several minutes depending on the number of articles."
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            cd backend
            npx ts-node src/scripts/vectorizeArticles.ts
            cd ..
            echo ""
            echo "✅ Vectorization complete!"
        else
            echo "Skipped vectorization."
        fi
        ;;
esac

case $choice in
    2|3)
        echo ""
        echo "=========================================="
        echo "Testing API Endpoint"
        echo "=========================================="
        echo ""
        echo "To test the similar articles endpoint, we need an article ID."
        echo "You can find article IDs by browsing to http://localhost:3000/api/articles"
        echo ""
        read -p "Enter an article ID (or press Enter to skip): " article_id
        
        if [ -n "$article_id" ]; then
            echo ""
            echo "Testing endpoint: /api/articles/$article_id/similar"
            echo ""
            
            # Check if backend is running
            if curl -s http://localhost:3000/api/articles/$article_id/similar > /dev/null 2>&1; then
                echo "Response:"
                curl -s http://localhost:3000/api/articles/$article_id/similar | python3 -m json.tool 2>/dev/null || \
                curl -s http://localhost:3000/api/articles/$article_id/similar | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0)), null, 2))" 2>/dev/null || \
                curl -s http://localhost:3000/api/articles/$article_id/similar
                echo ""
                echo "✅ API test complete!"
            else
                echo "❌ Could not connect to backend. Is it running on http://localhost:3000?"
                echo "   Start it with: cd backend && npm run dev"
            fi
        else
            echo "Skipped API test."
        fi
        ;;
esac

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Start the backend: cd backend && npm run dev"
echo "2. Start the frontend: cd frontend && npm run dev"
echo "3. Navigate to an article: http://localhost:3001/articles/[id]"
echo "4. See the Related Articles carousel below the rating section"
echo ""
echo "For more information, see:"
echo "- QUICKSTART_RELATED_ARTICLES.md"
echo "- RELATED_ARTICLES.md"
echo ""
