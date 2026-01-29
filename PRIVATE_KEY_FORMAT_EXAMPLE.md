# How to Format DocuSign Private Key for .env

## What You'll Receive from DocuSign

When you click "Generate RSA" in the DocuSign developer portal, you'll see a popup with a key that looks like this:

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAxyz+xtz6d3uMlQj2V3Vn8J7l9YaJPdO0N8r+E5w3xT2qYk0K
F9K0d1EZqR5h2xJ6vZ8wU9N5L4J9xK3H5eQ6tP0R2fJ8n1L6mQ8kJ7yP4H5wR6tX
... (many more lines like this) ...
-----END RSA PRIVATE KEY-----
```

## Option 1: Single-Line Format (Recommended)

Convert all the newlines to `\n` literal characters:

### In your .env file:

```bash
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAxyz+xtz6d3uMlQj2V3Vn8J7l9YaJPdO0N8r+E5w3xT2qYk0K\nF9K0d1EZqR5h2xJ6vZ8wU9N5L4J9xK3H5eQ6tP0R2fJ8n1L6mQ8kJ7yP4H5wR6tX\n...\n-----END RSA PRIVATE KEY-----"
```

**Steps:**
1. Copy the entire key from DocuSign
2. Remove all actual newlines
3. Replace each newline position with `\n`
4. Wrap in quotes
5. Paste into .env

## Option 2: Multi-Line Format

Keep the original format with actual newlines:

### In your .env file:

```bash
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAxyz+xtz6d3uMlQj2V3Vn8J7l9YaJPdO0N8r+E5w3xT2qYk0K
F9K0d1EZqR5h2xJ6vZ8wU9N5L4J9xK3H5eQ6tP0R2fJ8n1L6mQ8kJ7yP4H5wR6tX
... (paste all lines exactly as received)
-----END RSA PRIVATE KEY-----"
```

**Steps:**
1. Copy the entire key from DocuSign
2. Paste directly into .env with quotes
3. Keep all newlines intact

## Quick Script to Convert (If Needed)

If you have the key saved in a file, you can convert it to single-line format:

```bash
# On Mac/Linux:
cat your-private-key.txt | tr '\n' '~' | sed 's/~/ \\n/g'

# Then copy the output and paste into .env
```

## Common Mistakes to Avoid

### ❌ Wrong: Missing BEGIN/END lines
```bash
DOCUSIGN_PRIVATE_KEY="MIIEpAIBAAKCAQEAxyz..."
```

### ❌ Wrong: Extra spaces
```bash
DOCUSIGN_PRIVATE_KEY=" -----BEGIN RSA PRIVATE KEY-----"  # Leading space
```

### ❌ Wrong: Missing quotes
```bash
DOCUSIGN_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...
```

### ✅ Correct: Option 1 (Single-line)
```bash
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBA...\n-----END RSA PRIVATE KEY-----"
```

### ✅ Correct: Option 2 (Multi-line)
```bash
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"
```

## How to Verify Format

After updating your .env, you can test if the format is correct:

```bash
# Run the test script
npm run test:docusign
```

If you see:
- ✅ "JWT authentication successful" → Format is correct!
- ❌ "JWT authentication failed" → Format needs fixing

## Need Help?

If the format is still not working:
1. Double-check there are no extra spaces
2. Make sure you copied the ENTIRE key including BEGIN/END
3. Try the alternative format (single-line vs multi-line)
4. Check that the Integration Key matches the one that generated this private key
