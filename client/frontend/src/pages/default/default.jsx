import './default.css'

var phrase = "My first impression of him was that he's not one to smile. After meeting him again more recently, however, he's still as reserved as ever, but... he seems a lot more relaxed now. Maybe he... met someone special."
var schem = "It + V + Obj + Inf, Pronoun + V + Adj + Inf, Noun Phrase"
var words = []
for (var word of phrase.split(" ")){
    words.push(word)
}

function Default(){
    return(
        <>
        <div className="pages">
            <div className='main-elements'>
            <div className="ocr-text">
                <div className='default-text'>
                    {
                        words.map((word, i) => (
                            <span 
                                key={i} 
                                className="word"
                                onClick={() => console.log(word)}>
                                    {word + " "}
                            </span>
                        )
                    )
                    }
                </div>
                {/* <p className='default-text'>{words}</p> */}
                {/* <p className='verb-text'>It pains me to + V</p> */}
            </div>

            <div className='explanations'>
                <div className='explanation'>
                    <div className='sentences'>
                        <p className='sentence'>
                            My first impression of him 
                            <span style={{ 
                                color: '#B3A5DE',
                                display: 'inline-block',
                                padding: '0 0.2em 0.06em',
                                borderBottom: '2px solid #B3A5DE',
                                borderRadius: '0.35em',
                                lineHeight: 1.4,
                                textDecoration: 'none' 
                            }}>was</span>  
                        that <span style={{ 
                                color: '#B3A5DE',
                                display: 'inline-block',
                                padding: '0 0.2em 0.06em',
                                borderBottom: '2px solid #B3A5DE',
                                borderRadius: '0.35em',
                                lineHeight: 1.4,
                                textDecoration: 'none' 
                            }}>he's not one to smile</span> 
                        </p>
                        <p className='sentence-translation'>
                            Моё первое впечатление о нём было, что он не из тех, кто улыбается.
                        </p>
                    </div>
                    <div className='grammars'>
                        <p className='Category' style={{ color: '#B3A5DE' }} >Время</p>
                        <p className='gramar'>
                            Главное предложение в прошедшем (was), но придаточное осталось в настоящем (he's), а не «he wasn't». Так бывает, когда описанная черта всё ещё верна сейчас. Если бы она перестала быть актуальной, время сдвинулось бы: «...was that he wasn't one to smile».
                        </p>
                    </div>
                </div>

                                <div className='explanation'>
                    <div className='sentences'>
                        <p className='sentence'>
                            My first impression of him 
                            <span style={{ 
                                color: '#B3A5DE',
                                display: 'inline-block',
                                padding: '0 0.2em 0.06em',
                                borderBottom: '2px solid #B3A5DE',
                                borderRadius: '0.35em',
                                lineHeight: 1.4,
                                textDecoration: 'none' 
                            }}>was</span>  
                        that <span style={{ 
                                color: '#B3A5DE',
                                display: 'inline-block',
                                padding: '0 0.2em 0.06em',
                                borderBottom: '2px solid #B3A5DE',
                                borderRadius: '0.35em',
                                lineHeight: 1.4,
                                textDecoration: 'none' 
                            }}>he's not one to smile</span> 
                        </p>
                        <p className='sentence-translation'>
                            Моё первое впечатление о нём было, что он не из тех, кто улыбается.
                        </p>
                    </div>
                    <div className='grammars'>
                        <p className='Category' style={{ color: '#B3A5DE' }} >Время</p>
                        <p className='gramar'>
                            Главное предложение в прошедшем (was), но придаточное осталось в настоящем (he's), а не «he wasn't». Так бывает, когда описанная черта всё ещё верна сейчас. Если бы она перестала быть актуальной, время сдвинулось бы: «...was that he wasn't one to smile».
                        </p>
                    </div>
                </div>
            </div>
        </div>
        </div>

        {/* <button className='btn-get-frame'>🔎</button> */}
    </>
    )
}

export default Default