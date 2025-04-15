import InfluencersSchema from '../influencers/InfluencersSchema.js';
import multer from 'multer';
import cloudinary from 'cloudinary';
import puppeteer, { Puppeteer } from 'puppeteer';
import OpenAI from "openai";
import dotenv from 'dotenv';
import UserSchema from '../users/UserSchema.js';
dotenv.config();

const storage = multer.diskStorage({});
const upload = multer({ storage }); 
const hunterIoApiKey = process.env.HUNTER_IO_API_KEY;
const snovIoUserId = process.env.SNOV_USER_ID;
const snovIoSecret = process.env.SNOV_SECRET;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
const openAiApiKey = process.env.OPENAI_API_KEY;
const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
//Configure Cloudinary
cloudinary.config({
    cloud_name: 'dza3ed8yw',
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret
});

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
    apiKey: openAiApiKey, // Replace with your OpenAI API key
});

const deepSeekAi = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: deepSeekApiKey
});

/*
// Function to fetch emails by domain
const getEmailsByDomain = async (firstName, domain) => {
    // Extract domain from the URL
    const match = domain.match(/:\/\/(?:www\.)?([^/]+)/);
    const domainEmail = match ? match[1] : null;

    if (!domainEmail) return null; // Early return if no valid domain

    const possibleEmail = `${firstName}@${domainEmail}`;

    const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterIoApiKey}`;
    const url2 = `https://api.hunter.io/v2/email-verifier?email=${possibleEmail}&api_key=${hunterIoApiKey}`;

    try {
        // Fetch domain search response
        const response = await fetch(url);

        if (!response.ok) {
            console.error('Error fetching domain search data:', response.status);
            return null;
        }

        const data = await response.json();

        // Check if any emails are found in the domain search
        if (_.isEmpty(data?.data?.emails)) {
            // If no emails, verify the possible email
            const response2 = await fetch(url2);

            if (!response2.ok) {
                console.error('Error verifying email:', response2.status);
                return null;
            }

            return response2.json();
        }

        // Return domain search emails if available
        return data;

    } catch (error) {
        console.error('Error fetching from Hunter.io:', error);
        return null;
    }
};
*/

// Async function to make the request
const fetchInfleuncersDataFromChatGPT = async(bio, profileName, category, username, fullName, profilePicUrl, externalUrl, bioLinksFound) => {
    if(category == 'Dating Coach') {
        category = 'Dating, Relationship or Marriage Coach'
    }
    if(category == 'Fitness Coach') {
        category = 'Fitness/Workout Coach or Fitness/Workout Trainer'
    }

    try {
        const messages = [
            {
              role: "user",
              content: `Please analyze the following Instagram influencer's profile and provide structured data:
          
          - **Bio:** "${bio}"
          - **Profile Name:** "${profileName}"
          - **Username:** "${username}"
          - **Full Name:** "${fullName}"
          - **Category:** "${category}"
          - **Profile Picture URL:** "${profilePicUrl}"
          - **External URL:** "${externalUrl}"
          - **Bio Links Found:** ${JSON.stringify(bioLinksFound)} (array of URLs)
          
          **Instructions:**
          1. **Is the influencer of the correct type?** (Based on bio and profile name)
             - Return **true** or **false**.
          2. **Is the profile picture of a real person (not a company logo/fake page)?**
             - Analyze the image and return **true** (if a real person) or **false**.
          3. **Extract any emails from the bio.**
             - Return an array of emails found. If none, return \`[]\`.
          4. **Parse the influencer’s real name (if available).**
             - Return the full name or \`null\` if not present.
          5. **Classify the external link (if provided).**
             - Possible values: **"MINI-SITE"**, **"BUSINESS-SITE"**, or **"null"**.
          6. **Determine the official business website from bio links.**
             - Prioritize shortest root domain. Return the official site or \`null\`.
          
          **Return a single JSON object in the following format:**
          \`\`\`json
          {
              "isCorrectInfluencerType": true/false,
              "isAvatarAPerson": true/false,
              "emailsInBio": ["email@example.com", "other@email.com"],
              "influencerRealName": "First Last" or null,
              "linkType": "MINI-SITE" or "BUSINESS-SITE" or "null",
              "influencerWebsiteDomain": "example.com" or "null"
          }
          \`\`\`
          
          **Do not include any extra text, only return the JSON object.**`
            }
        ];

        const completion = await deepSeekAi.chat.completions.create({
            //model: "gpt-4",
            model: 'deepseek-reasoner', // Changed from "deepseek-chat AKA" to "r1",
            store: true,
            "messages": [
                {
                    "role": "user",
                    "content": `Can you parse this Instagram influencer's account bio and profile name:\n\nBio: ${bio}.\n\nProfile name: ${profileName}.\n\nBased on this data, determine if this influencer is a ${category}. If so, return only the string \"true\" (without any other text). If not, return only the string \"false\" (without any other text). Do not return anything else.`
                }
            ]
        });

        const data = JSON.parse(completion.choices[0].message.content);
        return data;
    } catch (error) {

    }
}

// Async function to make the request
const isCorrectInfluencerType = async(bio, profileName, category) => {
    if(category == 'Dating Coach') {
        category = 'Dating, Relationship or Marriage Coach'
    }
    if(category == 'Fitness Coach') {
        category = 'Fitness/Exercise Coach or Fitness/Exercise Trainer'
    }

    try {
        const completion = await deepSeekAi.chat.completions.create({
            //model: "gpt-4",
            model: 'deepseek-chat', // Changed from "deepseek-chat AKA" to "deepseek-reasoner",
            store: true,
            "messages": [
                {
                    "role": "user",
                    "content": `Can you parse this Instagram influencer's account bio and profile name:\n\nBio: ${bio}.\n\nProfile name: ${profileName}.\n\nBased on this data, determine if this influencer is a ${category}. If so, return only the string \"true\" (without any other text). If not, return only the string \"false\" (without any other text). Do not return anything else.`
                }
            ]
        });

        const data = JSON.parse(completion.choices[0].message.content);
        return data;
    } catch (error) {

    }
}

const areEmailsInBio = async(bio) => {
    try {
        const completion = await deepSeekAi.chat.completions.create({
            //model: "gpt-4",
            model: 'deepseek-chat', // Changed from "deepseek-chat AKA" to "deepseek-reasoner",
            store: true,
            "messages": [
                {
                    "role": "user",
                    "content": `Can you parse this Instagram influencer's account bio:\n\nBio: ${bio}.\n\nIf you find any emails in their bio, return a single array, and individually push each email found inside of the array (each email should be of type String). If no emails are found in the bio, then just return the string \"null\".`
                }
            ]
        });
        const data = JSON.parse(completion.choices[0].message.content);
        return data;
    } catch (error) {

    }
}

// Async function to make the request
const isCorrectLeadType = async(bio, profileName) => {
    try {
        const completion = await deepSeekAi.chat.completions.create({
            //model: "gpt-4",
            model: 'deepseek-reasoner', // Changed from "deepseek-chat AKA" to "r1",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Please parse this Instagram users account bio: "${bio}", and profile name: "${profileName}". Tell me if this influencer is 
                    a freelance copywriter that helps online businesses, online coaches or online influencers that sell info products grow/generate more revenue.
                    If the answer is yes, please reply with only "true". If the answer is no, or if you arent sure/confident in your answer, please reply with only "false".`
                },
            ]
        });
        const data = JSON.parse(completion.choices[0].message.content);
        return data;
    } catch (error) {

    }
}

const getInfluencersRealName = async(name, category, username, bio, bioLink) => {
    try {
        console.log(category)
        if(category == 'Dating Coach') {
            category = 'Dating, Relationship or Marriage Coach'
        }
        if(category == 'Fitness Coach') {
            category = 'Fitness/Workout Coach or Fitness/Workout Trainer'
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "user",
                    content: `Try to extract the Instagram influencer's real name from their profile name or bio. This influencer is a ${category}.
                    Name: ${name}
                    Bio: ${bio}
                     
                    - The name should include both first and last names if available, but sometimes only the first name is present.  
                    - Never return a name with "Coach" in it.
                    - If a name is found, return their name only, no other text
                    - If no name is found, return only "null"`
                }
            ]
        });

        const data = completion.choices[0].message.content;
        return data;
    } catch (error) {
        return null;
    }
}

const isAvatarAPerson = async(url) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo", // Replace with the appropriate model, if needed
        messages: [
            { 
                role: "user", 
                content: [
                    { 
                        type: "text", 
                        text: `I have this URL to an Instagram influencer's profile picture/avatar: "${url}". Typically, if the profile picture is not of a **real person** or **the influencer themselves**, it’s either a fake page or a company page.  
                        I want to filter out all fake and company Instagram pages. Please analyze the image and determine if the profile picture is of the influencer themselves.  
                        - If the image is of a **real person** or the **influencer themselves**, respond with "true".  
                        - If the image is not of the influencer (e.g: a company logo or stock image), respond with "false".  
                        
                        **Response Format (Strictly return only:**  
                        - "true" (if it’s a person)  
                        - "false" (if not a person)`
                    },
                    {
                        type: "image_url",
                        image_url: { 
                            url: url 
                        }
                    },
                ]
            }
        ],
        max_tokens: 300,
    });

    const data = await JSON.parse(response.choices[0].message.content);
    return data;
  } catch (error) {
    return null;
  }
}

const scrapeForInfluencersWebsiteDomain = async(links, name, category) => {
    try {
        if(category == 'Dating Coach') {
            category = 'Dating, Relationship or Marriage Coach'
        }
        if(category == 'Fitness Coach') {
            category = 'Fitness/Workout Coach or Fitness/Workout Trainer'
        }

        const completion = await deepSeekAi.chat.completions.create({
            model: 'deepseek-reasoner', // Changed from "deepseek-chat AKA" to "deepseek-reasoner",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Analyze the following links:  
                    - Links: ${links}" 
            
                    Identify the **official business website** of ${name} who is a ${category} influencer, by following these rules:  
                    - Prioritize the **shortest root domain** (e.g: "example.com" over "sub.example.com").  
                    - Ignore subdomains unless no root domain exists.  
                    - If multiple links share the same root domain, return the simplest, shortest link only (without quotes). 
                    - If no business website is found, return "null" (without quotes).  
            
                    **Response Format (Strictly return only 1 link or "null", no extra text):**`
                }
            ],
            temperature: 0
        });

        return completion.choices[0].message.content;
    } catch (error) {
        return null;
    }
}

const identifyLinkType = async(link, name, category) => {
    try {
        const completion = await deepSeekAi.chat.completions.create({
            //model: "gpt-4",
            model: 'deepseek-chat', // Changed from "deepseek-chat AKA" to "deepseek-reasoner",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Analyze the following link and classify it accordingly:  
                    - Link: ${link}
            
                    Determine if the link falls into one of these categories:  
                    - MINI-SITE → A multi-link mini-site (e.g: Linktree, Beacons, Tap.bio, etc.).  
                    - BUSINESS-SITE → The influencer’s official business website.  
                    - null → If the link is neither a mini-site nor an official business website.  
            
                    **Response Format (Strictly return only one of the following, no extra text):**  
                    - MINI-SITE
                    - BUSINESS-SITE  
                    - null`
                }
            ]
        });

        return completion.choices[0].message.content;
    } catch (error) {
        return null;
    }
}

const scrapeBioLinkForMoreLinks = async(url) => {
    try {
      return await scrapeLink(url);
  } catch (error) {
    return []
  }
}

const updateEngagementRates = async(influencers) => {
  let index = 0;
  let savedCount = 0;

  for (let influencer of influencers) {
    const influencerFound = await InfluencersSchema.findOne({usernameIG: influencer.username});

   if(influencerFound && influencerFound != null) {
    //CALCULATE INFLUENCERS ENGAGEMENT RATE (last 10 posts)
    const latestPost0CommentsCount = Number(influencer['latestPosts/0/commentsCount']) || 0;
    const latestPost0LikesCount = Number(influencer['latestPosts/0/likesCount']) || 0;
    //const latestPost0VideoView = Number(influencer['latestPosts/0/videoViewCount']) || 0;
    const totalPost0 = (latestPost0CommentsCount + latestPost0LikesCount);

    const latestPost1CommentsCount = Number(influencer['latestPosts/1/commentsCount']) || 0;
    const latestPost1LikesCount = Number(influencer['latestPosts/1/likesCount']) || 0;
    //const latestPost1VideoView = Number(influencer['latestPosts/1/videoViewCount']) || 0;
    const totalPost1 = (latestPost1CommentsCount + latestPost1LikesCount);

    const latestPost2CommentsCount = Number(influencer['latestPosts/2/commentsCount']) || 0;
    const latestPost2LikesCount = Number(influencer['latestPosts/2/likesCount']) || 0;
    //const latestPost2VideoView = Number(influencer['latestPosts/2/videoViewCount']) || 0;
    const totalPost2 = (latestPost2CommentsCount + latestPost2LikesCount);

    const latestPost3CommentsCount = Number(influencer['latestPosts/3/commentsCount']) || 0;
    const latestPost3LikesCount = Number(influencer['latestPosts/3/likesCount']) || 0;
    //const latestPost3VideoView = Number(influencer['latestPosts/3/videoViewCount']) || 0;
    const totalPost3 = (latestPost3CommentsCount + latestPost3LikesCount);

    const latestPost4CommentsCount = Number(influencer['latestPosts/4/commentsCount']) || 0;
    const latestPost4LikesCount = Number(influencer['latestPosts/4/likesCount']) || 0;
    //const latestPost4VideoView = Number(influencer['latestPosts/4/videoViewCount']) || 0;
    const totalPost4 = (latestPost4CommentsCount + latestPost4LikesCount);

    const latestPost5CommentsCount = Number(influencer['latestPosts/5/commentsCount']) || 0;
    const latestPost5LikesCount = Number(influencer['latestPosts/5/likesCount']) || 0;
    //const latestPost5VideoView = Number(influencer['latestPosts/5/videoViewCount']) || 0;
    const totalPost5 = (latestPost5CommentsCount + latestPost5LikesCount);

    const latestPost6CommentsCount = Number(influencer['latestPosts/6/commentsCount']) || 0;
    const latestPost6LikesCount = Number(influencer['latestPosts/6/likesCount']) || 0;
    //const latestPost6VideoView = Number(influencer['latestPosts/6/videoViewCount']) || 0;
    const totalPost6 = (latestPost6CommentsCount + latestPost6LikesCount);

    const latestPost7CommentsCount = Number(influencer['latestPosts/7/commentsCount']) || 0;
    const latestPost7LikesCount = Number(influencer['latestPosts/7/likesCount']) || 0;
    //const latestPost7VideoView = Number(influencer['latestPosts/7/videoViewCount']) || 0;
    const totalPost7 = (latestPost7CommentsCount + latestPost7LikesCount);

    const latestPost8CommentsCount = Number(influencer['latestPosts/8/commentsCount']) || 0;
    const latestPost8LikesCount = Number(influencer['latestPosts/8/likesCount']) || 0;
    //const latestPost8VideoView = Number(influencer['latestPosts/8/videoViewCount']) || 0;
    const totalPost8 = (latestPost8CommentsCount + latestPost8LikesCount);

    const latestPost9CommentsCount = Number(influencer['latestPosts/9/commentsCount']) || 0;
    const latestPost9LikesCount = Number(influencer['latestPosts/9/likesCount']) || 0;
    //const latestPost9VideoView = Number(influencer['latestPosts/9/videoViewCount']) || 0;
    const totalPost9 = (latestPost9CommentsCount + latestPost9LikesCount);

    const latestPost10CommentsCount = Number(influencer['latestPosts/10/commentsCount']) || 0;
    const latestPost10LikesCount = Number(influencer['latestPosts/10/likesCount']) || 0;
    //const latestPost10VideoView = Number(influencer['latestPosts/10/videoViewCount']) || 0;
    const totalPost10 = (latestPost10CommentsCount + latestPost10LikesCount);

    const latestPost11CommentsCount = Number(influencer['latestPosts/11/commentsCount']) || 0;
    const latestPost11LikesCount = Number(influencer['latestPosts/11/likesCount']) || 0;
    //const latestPost11VideoView = Number(influencer['latestPosts/11/videoViewCount']) || 0;
    const totalPost11 = (latestPost11CommentsCount + latestPost11LikesCount);

    const totalEngagement = [
        totalPost0 || 0, totalPost1 || 0, totalPost2 || 0, totalPost3 || 0, totalPost4 || 0, 
        totalPost5 || 0, totalPost6 || 0, totalPost7 || 0, totalPost8 || 0, totalPost9 || 0, 
        totalPost10 || 0, totalPost11 || 0
    ];

    const medianEngagement = getMedianEngagement(totalEngagement);
    const engagementRate = (medianEngagement / Number(influencerFound.followersIGNum)) * 100;
    const newEngagement = parseFloat(engagementRate.toFixed(1));

    if(newEngagement) {
        await InfluencersSchema.findOneAndUpdate(
            { usernameIG: influencer.username },
            { $set: { engagement: newEngagement }},
            { new: true }
        );
        savedCount++;
        index++;
        console.log(`✅ Row #${index} complete. Influencers Updated: ${savedCount} / Influencers Processed: ${index}`);
    } else {
        index++;
    }
    
   }
  }
}

const updateBioEmails = async(influencers) => {
    let updatedCount = 0;
    let index = 0;

    for (let influencer of influencers) {
      const influencerFound = await InfluencersSchema.findOne({usernameIG: influencer.username});
  
      if(influencerFound) {
        if (!influencer.bioEmail) return; // Skip if bioEmail is empty

        // Extract the first email if multiple exist
        const firstEmail = influencer.bioEmail.split(',')[0].trim().toLowerCase();

        // Convert existing emails to lowercase for comparison
        const emailsLowerCase = influencerFound.emails.map(email => email.toLowerCase());
    
        // Check if email is valid and not already in the array
        if (firstEmail && !emailsLowerCase.includes(firstEmail)) {
            influencerFound.emails.push(firstEmail);

            await InfluencersSchema.findOneAndUpdate(
              { usernameIG: influencer.username },
              { $set: { emails: influencerFound.emails }},
              { new: true }
            );

            updatedCount++;
            index++;
            console.log(`✅ Row #${index} complete. Influencers Updated: ${updatedCount} / Influencers Processed: ${index}`);
        }
      } else {
          index++;
      }
      
    }
}

const removeDuplicateGrowmanInfluencersForApify = async(req, res,) => {
    const csv = req.body;
    const newList = [];

    return newList;
}

const getUsername = async(url) => {
    const urlObj = new URL(url); // Create a URL object
    const parts = urlObj.pathname.split("/").filter(Boolean); // Get path parts
    return parts[0]; // The first non-empty part is the username
}

const testImportFile = async(req, res, next) => {
    const csv = req.body;
    let category = csv.data.category;
    let influencerIndex = 0; // To track the loop iteration
    let savedCount = 0; // To count successfully saved influencers
    const adminUser = await UserSchema.findOne({admin: true});

    if(category == 'Update DB') {
        await mapVerifiedEmailsToInfluencers(csv.data.data);
    } else if(category == 'Update DB Emails') {
        await mapGrowmanEmailsToInfluencers(csv.data.data, csv.data.category);
    } else if(category == 'Clean List') {
        const leads = await cleanLeadList(csv.data.data);
        res.json({ verifiedLeads: leads });
    } else if(category == 'Pull Possible Emails') {
        const pulledEmails = await pullPossibleEmailsFromDB();
        res.json({ pulledEmails: pulledEmails });
    } else if(category == 'Update Engagement Rates') {
        await updateEngagementRates(csv.data.data);
    } else if(category == 'Update Bio Emails') {
        await updateBioEmails(csv.data.data);
    } else {
        const allPossibleEmails = [];

     for(let influencer of csv.data.data) {
      if(influencer.username != "" && (!await InfluencersSchema.findOne({usernameIG: influencer.username}) && !adminUser.influencersChecked.includes(influencer.username))) {
        adminUser.influencersChecked.push(influencer.username);
        adminUser.save();

        //const chatGptData = await fetchInfleuncersDataFromChatGPT();
        const isCorrectInfluencerTypeData = await isCorrectInfluencerType(influencer.biography, influencer.fullName, `${category} Coach`);
        if(isCorrectInfluencerTypeData && isCorrectInfluencerTypeData !== false && isCorrectInfluencerTypeData !== 'false') {
            console.log('isCorrectInfluencerType:', true)
            const isAvatarAPersonResult = await isAvatarAPerson(influencer.profilePicUrl);
            if(isAvatarAPersonResult === true || isAvatarAPersonResult === 'true') {
                console.log('isCorrectAvatar:', true)
                const influencerToAdd = {};
                const emails = [];
                const emailsSeen = [];
                let emailsInBio = [];
                if(influencer.bioEmail) {
                    emailsInBio = influencer.bioEmail?.split(',')[0].trim().toLowerCase();
                }
                console.log('isEmailInBio:', emailsInBio);

                influencerToAdd.category = `${category} Coach`;
                let influencersRealName = await getInfluencersRealName(influencer.fullName, influencerToAdd.category, influencer.username, influencer.biography, influencer.externalUrl);
                if(influencersRealName !== null && influencersRealName !== 'null') {
                    console.log('influencersRealName:', influencersRealName);

                    const linkType = influencer.externalUrl ? await identifyLinkType(influencer.externalUrl, influencersRealName, influencerToAdd.category) : null;
                
                    if(linkType && linkType != null && linkType != "null") {
                        console.log('linkType:', linkType);
                        console.log('SCRAPING LINK FOR MORE LINKS............')
                        const bioLinksFound = await scrapeBioLinkForMoreLinks(influencer.externalUrl);
                        console.log('moreLinksFound:', bioLinksFound)
                        if(bioLinksFound && Array.isArray(bioLinksFound) && bioLinksFound?.length) {
                            const emailInLinks = bioLinksFound?.filter(link => link?.startsWith("mailto:")).map(link => link?.replace("mailto:", ""));
                            if(emailInLinks && Array.isArray(emailInLinks) && emailInLinks?.length) {
                                emailInLinks.forEach((email) => {
                                    if(!emailsSeen.includes(email)) {
                                        emails.push(String(email).split('?')[0].replace(/^["']|["']$/g, '').toLowerCase());
                                        emailsSeen.push(String(email).split('?')[0].replace(/^["']|["']$/g, '').toLowerCase());
                                    }
                                });
                            }
                        }
                    
                        if(String(linkType) === 'MINI-SITE' && bioLinksFound?.length) {
                            const getInfuencersWebsiteDomain = await scrapeForInfluencersWebsiteDomain(bioLinksFound, influencersRealName, influencerToAdd.category);
                            if(getInfuencersWebsiteDomain !== 'null' && getInfuencersWebsiteDomain !== null) {
                                influencerToAdd.domain = String(getInfuencersWebsiteDomain).split('?')[0].replace(/^["']|["']$/g, '').toLowerCase();
                            }
                        } else if(String(linkType) === 'BUSINESS-SITE') {
                            influencerToAdd.domain = String(influencer.externalUrl).split('?')[0].replace(/^["']|["']$/g, '').toLowerCase();
                        }
                    } else {        
                        influencerToAdd.domain = null;
                    }
                    console.log('domain:', influencerToAdd.domain);

                    influencerToAdd.usernameIG = influencer.username;

                    const nameParts = influencersRealName?.trim()?.split(/\s+/);
                    influencerToAdd.firstName = nameParts[0] || "";

                    const lastNamePrefixes = ["o'", "o", "da", "de", "st", "st.", "di", "del"];
                    const isPrefix = lastNamePrefixes.includes(nameParts[1]?.toLowerCase());
                    const fullLastName = isPrefix && nameParts.length > 2
                        ? nameParts.slice(1).join(" ") // Join all remaining parts for correct last name
                        : !isPrefix && nameParts.length > 2 
                        ? nameParts[2]
                        : nameParts[1] || null; // Use just the second part if no prefix
                    influencerToAdd.lastName = fullLastName;
                    
                    influencerToAdd.fullName = fullLastName 
                        ? `${influencerToAdd.firstName} ${fullLastName}` 
                        : influencerToAdd.firstName;
                        
                    influencerToAdd.profileUrlIG = influencer.inputUrl;
                    influencerToAdd.followersIG = formatNumberToSuffix(Number(influencer.followersCount));
                    influencerToAdd.followersIGNum = Number(influencer.followersCount); //convertToNumber(String(followersIG)) || 0;

                    if (influencerToAdd.domain && influencerToAdd.firstName) {
                        const cleanDomain = String(influencerToAdd.domain).split('?')[0].replace(/^["']|["']$/g, '').toLowerCase(); // Removes leading/trailing quotes
                        const match = cleanDomain.match(/:\/\/(?:www\.)?([^/]+)/);
                        const domainEmail = match ? match[1] : null;

                        if (domainEmail) {
                            console.log('PUSHING POSSIBLE EMAILS...........')
                            const possibleEmail = `${influencerToAdd.firstName.toLowerCase()}@${domainEmail}`;
                            influencerToAdd.possibleEmails = [possibleEmail];
                            // Check if lastName is present and add more variations
                            if (influencerToAdd.lastName) {
                                const firstNameLower = influencerToAdd.firstName.toLowerCase();
                                const lastNameLower = influencerToAdd.lastName.toLowerCase();
                                const formattedLastName = lastNameLower?.replace(/\s+/g, "");
                               
                                // Add variations to the possibleEmails array
                                influencerToAdd.possibleEmails.push(`${firstNameLower}${formattedLastName}@${domainEmail}`);  // firstname + lastname
                                influencerToAdd.possibleEmails.push(`${firstNameLower}.${formattedLastName}@${domainEmail}`);  // firstname.lastName
                                influencerToAdd.possibleEmails.push(`${firstNameLower.charAt(0)}${formattedLastName}@${domainEmail}`);  // first initial + lastname
                            }
                            allPossibleEmails.push(possibleEmail);
                        }

                        let emailsInBioFound;
                        if (Array.isArray(emailsInBio)) {
                            // If it's already an array, just assign it directly
                            emailsInBioFound = emailsInBio;
                        } else if (typeof emailsInBio === "string") {
                            // Check if the string looks like a JSON array
                            try {
                                // Remove quotes from the string and parse it
                                emailsInBioFound = JSON.parse(emailsInBio);
                            } catch (error) {
                                console.error("Error parsing emailsInBio:", error);
                                emailsInBioFound = []; // Default to an empty array if parsing fails
                            }
                        } else {
                            emailsInBioFound = []; // Default to empty array if it's neither an array nor a valid string
                        }

                        if(emailsInBioFound !== null && emailsInBioFound !== 'null' && Array.isArray(emailsInBioFound) && emailsInBioFound?.length) {
                            emailsInBioFound.forEach((email) => {
                                if(!emailsSeen.includes(email)) {
                                    emails.push(String(email).split('?')[0].replace(/^["']|["']$/g, '').toLowerCase());
                                    emailsSeen.push(String(email).split('?')[0].replace(/^["']|["']$/g, '').toLowerCase());
                                }
                            });
                        }
                    
                        influencerToAdd.emails = emails;
                        //influencerToAdd.profileUrlFacebook = hunterIoData?.data?.facebook;
                        //influencerToAdd.profileUrlX = hunterIoData?.data?.twitter;
                        //influencerToAdd.profileUrlYoutube = hunterIoData?.data?.youtube;
                        //influencerToAdd.profileUrlLinkedIn = hunterIoData?.data?.linkedin;
                    } else {
                        influencerToAdd.emails = [];
                    }

                    if (influencer.profilePicUrl) {
                        try {
                            console.log('EXPORTING PROFILE PIC TO CLOUDINARY...................................')
                            const cloudinaryImg = await cloudinary.uploader.upload(influencer.profilePicUrl);
                            influencerToAdd.profilePic = cloudinaryImg;
                        } catch (error) {
                            console.error('Error uploading profile picture:', error);
                        }
                    } else {
                        console.log('No profile picture URL provided');
                    }

                    influencerToAdd.followersTotal = influencerToAdd.followersIG;
                    influencerToAdd.followersTotalNum = influencerToAdd.followersIGNum;

                    //CALCULATE INFLUENCERS ENGAGEMENT RATE (last 10 posts)
                    const latestPost0CommentsCount = Number(influencer['latestPosts/0/commentsCount']) || 0;
                    const latestPost0LikesCount = Number(influencer['latestPosts/0/likesCount']) || 0;
                    //const latestPost0VideoView = Number(influencer['latestPosts/0/videoViewCount']) || 0;
                    const totalPost0 = (latestPost0CommentsCount + latestPost0LikesCount);

                    const latestPost1CommentsCount = Number(influencer['latestPosts/1/commentsCount']) || 0;
                    const latestPost1LikesCount = Number(influencer['latestPosts/1/likesCount']) || 0;
                    //const latestPost1VideoView = Number(influencer['latestPosts/1/videoViewCount']) || 0;
                    const totalPost1 = (latestPost1CommentsCount + latestPost1LikesCount);

                    const latestPost2CommentsCount = Number(influencer['latestPosts/2/commentsCount']) || 0;
                    const latestPost2LikesCount = Number(influencer['latestPosts/2/likesCount']) || 0;
                    //const latestPost2VideoView = Number(influencer['latestPosts/2/videoViewCount']) || 0;
                    const totalPost2 = (latestPost2CommentsCount + latestPost2LikesCount);

                    const latestPost3CommentsCount = Number(influencer['latestPosts/3/commentsCount']) || 0;
                    const latestPost3LikesCount = Number(influencer['latestPosts/3/likesCount']) || 0;
                    //const latestPost3VideoView = Number(influencer['latestPosts/3/videoViewCount']) || 0;
                    const totalPost3 = (latestPost3CommentsCount + latestPost3LikesCount);

                    const latestPost4CommentsCount = Number(influencer['latestPosts/4/commentsCount']) || 0;
                    const latestPost4LikesCount = Number(influencer['latestPosts/4/likesCount']) || 0;
                    //const latestPost4VideoView = Number(influencer['latestPosts/4/videoViewCount']) || 0;
                    const totalPost4 = (latestPost4CommentsCount + latestPost4LikesCount);

                    const latestPost5CommentsCount = Number(influencer['latestPosts/5/commentsCount']) || 0;
                    const latestPost5LikesCount = Number(influencer['latestPosts/5/likesCount']) || 0;
                    //const latestPost5VideoView = Number(influencer['latestPosts/5/videoViewCount']) || 0;
                    const totalPost5 = (latestPost5CommentsCount + latestPost5LikesCount);

                    const latestPost6CommentsCount = Number(influencer['latestPosts/6/commentsCount']) || 0;
                    const latestPost6LikesCount = Number(influencer['latestPosts/6/likesCount']) || 0;
                    //const latestPost6VideoView = Number(influencer['latestPosts/6/videoViewCount']) || 0;
                    const totalPost6 = (latestPost6CommentsCount + latestPost6LikesCount);

                    const latestPost7CommentsCount = Number(influencer['latestPosts/7/commentsCount']) || 0;
                    const latestPost7LikesCount = Number(influencer['latestPosts/7/likesCount']) || 0;
                    //const latestPost7VideoView = Number(influencer['latestPosts/7/videoViewCount']) || 0;
                    const totalPost7 = (latestPost7CommentsCount + latestPost7LikesCount);

                    const latestPost8CommentsCount = Number(influencer['latestPosts/8/commentsCount']) || 0;
                    const latestPost8LikesCount = Number(influencer['latestPosts/8/likesCount']) || 0;
                    //const latestPost8VideoView = Number(influencer['latestPosts/8/videoViewCount']) || 0;
                    const totalPost8 = (latestPost8CommentsCount + latestPost8LikesCount);

                    const latestPost9CommentsCount = Number(influencer['latestPosts/9/commentsCount']) || 0;
                    const latestPost9LikesCount = Number(influencer['latestPosts/9/likesCount']) || 0;
                    //const latestPost9VideoView = Number(influencer['latestPosts/9/videoViewCount']) || 0;
                    const totalPost9 = (latestPost9CommentsCount + latestPost9LikesCount);

                    const latestPost10CommentsCount = Number(influencer['latestPosts/10/commentsCount']) || 0;
                    const latestPost10LikesCount = Number(influencer['latestPosts/10/likesCount']) || 0;
                    //const latestPost10VideoView = Number(influencer['latestPosts/10/videoViewCount']) || 0;
                    const totalPost10 = (latestPost10CommentsCount + latestPost10LikesCount);

                    const latestPost11CommentsCount = Number(influencer['latestPosts/11/commentsCount']) || 0;
                    const latestPost11LikesCount = Number(influencer['latestPosts/11/likesCount']) || 0;
                    //const latestPost11VideoView = Number(influencer['latestPosts/11/videoViewCount']) || 0;
                    const totalPost11 = (latestPost11CommentsCount + latestPost11LikesCount);

                    const totalEngagement = [
                        totalPost0 || 0, totalPost1 || 0, totalPost2 || 0, totalPost3 || 0, totalPost4 || 0, 
                        totalPost5 || 0, totalPost6 || 0, totalPost7 || 0, totalPost8 || 0, totalPost9 || 0, 
                        totalPost10 || 0, totalPost11 || 0
                    ];

                    const medianEngagement = getMedianEngagement(totalEngagement);

                    const engagementRate = (medianEngagement / Number(influencerToAdd.followersIGNum)) * 100;
                    influencerToAdd.engagement = parseFloat(engagementRate.toFixed(1));

                    influencerToAdd.platform = influencer.platform;
                    influencerToAdd.city = influencer.city;
                    influencerToAdd.state = influencer.state;
                    influencerToAdd.country = influencer.country;

                    influencerToAdd.updatedDate = new Date().toLocaleString();
                    console.log('FINAL VALIDATION.......')
                    if (areAllRowsValid(influencerToAdd)) {
                        console.log('SAVING!!!!!!!!!!!!!!!!!!')
                        try {
                            await InfluencersSchema.create(influencerToAdd);
                            savedCount++; // Increment the saved count
                        } catch (error) {
                            console.error('Error saving influencer:', error);
                        }
                    } else {
                        console.log('NOT ALL ROWS WERE VALID :( ..................')
                        console.log('Invalid influencer data, skipping save');
                    }
                }
            }
        }
      }
      influencerIndex++;
      console.log(`✅ Row #${influencerIndex} complete. Influencers Saved: ${savedCount} / Influencers Processed: ${influencerIndex}`);
     }  
     console.log(`🎉 Import completed. Total Influencers Saved: ${savedCount} / Total influencers Processed: ${influencerIndex}` );
     // Return all possible emails to frontend for CSV export
     res.json({ possibleEmails: allPossibleEmails });
    }
}

const getMedianEngagement = (posts) => {
    // Step 1: Filter out posts with a value of 0
    const filteredPosts = posts.filter(post => post > 0);

    // If no valid posts remain, return 0 to prevent errors
    if (filteredPosts.length === 0) return 0;

    // Step 2: Sort the array in ascending order
    const sortedPosts = filteredPosts.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedPosts.length / 2);

    // Step 3: Calculate median
    if (sortedPosts.length % 2 === 0) {
        return (sortedPosts[mid - 1] + sortedPosts[mid]) / 2;
    } else {
        return sortedPosts[mid];
    }
};

const mapGrowmanEmailsToInfluencers2 = async (influencers) => {
    for (const influencer of influencers) {
        const growmanEmails = influencer['Public email']?.split(',').map(email => email.trim()) || []; // Split and trim emails
        const influencerFound = await InfluencersSchema.findOne({ usernameIG: influencer['Username'] });

        if (influencerFound) {
            if (!influencerFound.fullName) {
                influencerFound.fullName = influencerFound.firstName 
                    ? influencerFound.lastName 
                        ? `${influencerFound.firstName} ${influencerFound.lastName}` 
                        : influencerFound.firstName 
                    : null;
            }

            for (const email of growmanEmails) {
                if (email && !influencerFound.emails?.some(existingEmail => existingEmail.toLowerCase() === email.toLowerCase())) {
                    influencerFound.emails.push(email);
                    console.log(`✅ Added verified email ${email} to ${influencerFound.usernameIG}`);
                }
            }

            // Save only if new emails were added
            if (growmanEmails.length > 0) {
                await influencerFound.save();
            }
        }
    }
};

const mapGrowmanEmailsToInfluencers = async (influencers, category) => {
    const adminUser = await UserSchema.findOne({admin: true});
    let i = 0;

    for (const influencer of influencers) {
        if(influencer.username && (!await InfluencersSchema.findOne({usernameIG: influencer.username}) && (!adminUser.influencersChecked.includes(influencer.username)))) {
            adminUser.influencersChecked.push(influencer.username);
        }
        i++;
        console.log(i)
    }
    adminUser.save();
};

const mapVerifiedEmailsToInfluencers = async (emails) => {
    for (const email of emails) {
        const snovEmail = email.Email;
        const emailStatus = email['Email status'];
        const influencer = await InfluencersSchema.findOne({ possibleEmails: { $in: [snovEmail] } });

        if (influencer) {
            if (emailStatus == "valid") {
                // 3️⃣ Check if email already exists in the "emails" array
                if (!influencer.emails?.some(email => email.toLowerCase() == snovEmail.toLowerCase())) {
                    influencer.emails.push(snovEmail);
                    
                    influencer.possibleEmails = influencer.possibleEmails?.filter(email => email.toLowerCase() != snovEmail.toLowerCase());

                    // 4️⃣ Save the updated document
                    await influencer.save();
                    console.log(`✅ Added verified email ${snovEmail} to ${influencer.usernameIG}`);
                } else {
                    console.log(`⚠️ Email ${snovEmail} already exists for ${influencer.usernameIG}`);
                }
            } else {
                // 5️⃣ Remove the email from the "possibleEmails" array if the status is not valid
                if(influencer.possibleEmails?.some(email => email.toLowerCase() == snovEmail.toLowerCase())) {
                    influencer.possibleEmails = influencer.possibleEmails?.filter(email => email.toLowerCase() != snovEmail.toLowerCase());

                    // 4️⃣ Save the updated document
                    await influencer.save();
                    console.log(`❌ Removed invalid email ${snovEmail} from ${influencer.usernameIG}'s possibleEmails`);
                }
            }
        } else {
            console.log(`❌ No influencer found for email: ${snovEmail}`);
        }
    }
}

const pullPossibleEmailsFromDB = async () => {
    const influencers = await InfluencersSchema.find({});
    const possibleEmails = [];

    for (let influencer of influencers) {
        if (!influencer?.possibleEmails?.length) continue;

        const primaryPossibleEmail = influencer.possibleEmails[0];
        //const domain = primaryPossibleEmail.split("@")[1];

        // Check if any emails in influencer.emails exist in influencer.possibleEmails
        const matches = influencer.emails?.filter(email => 
            influencer.possibleEmails.some(possibleEmail => possibleEmail.toLowerCase() === email.toLowerCase())
        ) || [];

        if (matches.length > 0) {
            // If there is a match, update DB with modified possibleEmails/clear it
            await InfluencersSchema.findByIdAndUpdate(influencer._id, {
                $set: { possibleEmails: [] }
            });
        } else {
            possibleEmails.push(primaryPossibleEmail);
        }
    }

    return possibleEmails;
};

const cleanLeadList = async (leads) => {
    const verifiedLeads = [];

    for(let lead of leads) {
        const isCorrectLead = await isCorrectLeadType(lead.Biography, lead['Full name']);
        if(isCorrectLead === 'true' ||isCorrectLead === true ) {
            verifiedLeads.push(lead);
        }
    }
    return verifiedLeads;
}

const formatNumberToSuffix = (num) => {
    if (num < 1000) {
      return num.toString(); // Numbers less than 1000 stay as-is
    }
  
    const suffixes = [
      { value: 1_000_000, symbol: 'M' },    // Million
      { value: 1_000, symbol: 'K' }         // Thousand
    ];
  
    for (const { value, symbol } of suffixes) {
      if (num >= value) {
        return (num / value).toFixed(1).replace(/\.0$/, '') + symbol;
      }
    }
  
    return num.toString(); // Fallback (not likely needed)
}


const convertToNumber = (input) => {
    // Define multipliers for suffixes
    const suffixMultiplier = {
        k: 1000, // Thousand
        m: 1000000, // Million
        b: 1000000000 // Billion
      };
    
      // Convert input to lowercase
      const normalizedInput = _.toLower(input);
    
      // Check for a valid suffix and multiply accordingly
      for (const [suffix, multiplier] of Object.entries(suffixMultiplier)) {
        if (_.endsWith(normalizedInput, suffix)) {
          const numericPart = parseFloat(normalizedInput.replace(suffix, ''));
          return numericPart * multiplier;
        }
      }
    
      // Return the number directly if no suffix is found
      return parseFloat(input);
}

const areAllRowsValid = ((influencer) => {
    if(influencer.firstName && influencer.usernameIG && influencer.profilePic && 
       influencer.followersTotal && influencer.category && influencer.updatedDate) {
        return true;
    }
    return false;

});

const getUsernameFromUrl = ((csv) => {
    const usernames = [];
    for(let influencer of csv) {
        const url = influencer['ACCOUNT_URL'];
        const match = url.match(/instagram\.com\/([^/]+)\/?$/);
        const username = match ? match[1] : null;
        if(username) {
            usernames.push(username);
        }
    }
    return usernames;
});

const updateInfluencersInDB = async(req, res, next) => {
    const request = req;
    const influencers = await InfluencersSchema.find(request.query);
}

const addInfluencersToDB = async(req, res, next) => {
    const request = req;
    const influencersToScrape = [];
    for(let influencer of influencersToScrape) {
        if(this.canAddInfluencer()) { //scrape profile data to see if influencer is a good fit for Distros DB

        }
    }
}

const getUpdatedDataFromApify = async(req, res, next) => {
    /*
    {
        //can only fetch 2173 per transaction
        "usernames": [
            "humansofny"
        ]
    }
    */
}


const scrapeLink = async (url) => {
    let browser;
    try {
        // Launch browser with some options for better performance
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Navigate to the URL and wait until DOM is fully loaded
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Extract all links
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href); // Filter out null or undefined hrefs
        });

        return links;
    } catch (error) {
        return []; // Return an empty array if an error occurs
    } finally {
        // Ensure the browser is always closed
        if (browser) {
            await browser.close();
        }
    }
};


const canAddInfluencer = async(req, res, next) => {
    
}

export { updateInfluencersInDB, addInfluencersToDB, testImportFile, convertToNumber, formatNumberToSuffix, getUpdatedDataFromApify };