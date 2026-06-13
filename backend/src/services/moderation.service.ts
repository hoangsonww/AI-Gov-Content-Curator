import OpenAI from "openai";
const openai = new OpenAI();

async function isToxic(text: string): Promise<void> {
    const toxicityCheck = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: text,
    });

    console.log(toxicityCheck.results)
}

isToxic("I hate gays");

